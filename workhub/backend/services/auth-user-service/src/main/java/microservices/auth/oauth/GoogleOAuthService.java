package microservices.auth.oauth;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import microservices.auth.config.GoogleOAuthProperties;
import microservices.auth.dto.GoogleProfileDTO;
import microservices.auth.dto.GoogleTokenInfo;
import microservices.auth.dto.GoogleTokenResponse;
import microservices.auth.dto.OAuthLoginResponse;
import microservices.auth.dto.OAuthStartResponse;
import microservices.auth.dto.UserDTO;
import microservices.auth.services.UserService;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class GoogleOAuthService {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthService.class);
    private final GoogleOAuthProperties properties;
    private final RestTemplate restTemplate = new RestTemplate();
    private final OAuthStateStore stateStore = new OAuthStateStore(600);
    private final UserService userService;
    private final SecureRandom secureRandom = new SecureRandom();

    public GoogleOAuthService(GoogleOAuthProperties properties, UserService userService) {
        this.properties = properties;
        this.userService = userService;
    }

    public String getFrontendRedirect() {
        return properties.getFrontendRedirect();
    }

    public String getCalendarFrontendRedirect() {
        return properties.getCalendarFrontendRedirect();
    }

    public OAuthStartResponse start() {
        ensureConfigured();

        String codeVerifier = randomCodeVerifier();
        String state = stateStore.save(codeVerifier);
        String codeChallenge = toCodeChallenge(codeVerifier);
        log.info("[OAuth] Generated PKCE codeVerifier len={} codeChallenge len={} hasPadding={} hasPlus={} hasSlash={}",
                codeVerifier.length(),
                codeChallenge.length(),
                codeChallenge.contains("="),
                codeChallenge.contains("+"),
                codeChallenge.contains("/"));

        String url = UriComponentsBuilder.fromHttpUrl(properties.getAuthorizationUri())
                .queryParam("client_id", properties.getClientId())
                .queryParam("redirect_uri", properties.getRedirectUri())
                .queryParam("response_type", "code")
                .queryParam("scope", properties.getScope())
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("include_granted_scopes", "true")
                .queryParam("state", state)
                .queryParam("code_challenge_method", "S256")
                .queryParam("code_challenge", codeChallenge)
                .toUriString();

        return new OAuthStartResponse(url, state);
    }

    public OAuthLoginResponse handleCallback(String code, String state) {
        ensureConfigured();

        String codeVerifier = stateStore.consume(state)
                .map(OAuthStateStore.StateData::codeVerifier)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired state"));

        GoogleTokenResponse tokenResponse = exchangeCode(code, codeVerifier);
        GoogleTokenInfo tokenInfo = fetchTokenInfo(tokenResponse.idToken());

        if (!properties.getClientId().equals(tokenInfo.aud())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid audience in id_token");
        }
        if (tokenInfo.email() == null || tokenInfo.email().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email not present in Google profile");
        }

        String fullName = Optional.ofNullable(tokenInfo.name()).filter(name -> !name.isBlank()).orElse(tokenInfo.email());
        GoogleProfileDTO profile = new GoogleProfileDTO(tokenInfo.sub(), tokenInfo.email(), fullName);

        boolean alreadyExists = userService.findByEmailIgnoreCase(profile.email()).isPresent();
        UserDTO user = userService.findOrCreateFromGoogle(profile, tokenResponse.refreshToken());

        boolean refreshStored = tokenResponse.refreshToken() != null && !tokenResponse.refreshToken().isBlank();
        return new OAuthLoginResponse(user, !alreadyExists, refreshStored);
    }

    private GoogleTokenResponse exchangeCode(String code, String codeVerifier) {
        return exchangeCode(code, codeVerifier, properties.getRedirectUri());
    }

    private GoogleTokenResponse exchangeCode(String code, String codeVerifier, String redirectUri) {
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("code", code);
        body.add("client_id", properties.getClientId());
        body.add("client_secret", properties.getClientSecret());
        body.add("redirect_uri", redirectUri);
        body.add("grant_type", "authorization_code");
        body.add("code_verifier", codeVerifier);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        ResponseEntity<GoogleTokenResponse> response = restTemplate.postForEntity(
                properties.getTokenUri(),
                new HttpEntity<>(body, headers),
                GoogleTokenResponse.class
        );

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to exchange authorization code");
        }

        return response.getBody();
    }

    private GoogleTokenInfo fetchTokenInfo(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "id_token missing in response");
        }

        URI uri = UriComponentsBuilder.fromHttpUrl(properties.getTokenInfoUri())
                .queryParam("id_token", idToken)
                .build()
                .toUri();

        ResponseEntity<GoogleTokenInfo> response = restTemplate.getForEntity(uri, GoogleTokenInfo.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to validate id_token");
        }
        return response.getBody();
    }

    private void ensureConfigured() {
        if (isBlank(properties.getClientId()) || isBlank(properties.getClientSecret()) || isBlank(properties.getRedirectUri())) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Google OAuth not configured");
        }
    }

    // -------- Calendar OAuth --------

    public OAuthStartResponse startCalendar(Long userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId requerido para Calendar");
        }
        ensureCalendarConfigured();

        String codeVerifier = randomCodeVerifier();
        String state = stateStore.save(codeVerifier, userId.toString());
        String codeChallenge = toCodeChallenge(codeVerifier);

        String url = UriComponentsBuilder.fromHttpUrl(properties.getAuthorizationUri())
                .queryParam("client_id", properties.getClientId())
                .queryParam("redirect_uri", properties.getCalendarRedirectUri())
                .queryParam("response_type", "code")
                .queryParam("scope", properties.getCalendarScope())
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("include_granted_scopes", "true")
                .queryParam("state", state)
                .queryParam("code_challenge_method", "S256")
                .queryParam("code_challenge", codeChallenge)
                .toUriString();

        return new OAuthStartResponse(url, state);
    }

    public void handleCalendarCallback(String code, String state) {
        ensureCalendarConfigured();

        OAuthStateStore.StateData data = stateStore.consume(state)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado invalido o expirado"));

        Long userId = parseUserId(data.meta());
        GoogleTokenResponse tokenResponse = exchangeCode(code, data.codeVerifier(), properties.getCalendarRedirectUri());

        if (tokenResponse.refreshToken() == null || tokenResponse.refreshToken().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Google no devolvio refresh_token. Prueba con prompt=consent");
        }

        userService.updateCalendarRefreshToken(userId, tokenResponse.refreshToken());
    }

    private void ensureCalendarConfigured() {
        if (isBlank(properties.getClientId()) || isBlank(properties.getClientSecret()) || isBlank(properties.getCalendarRedirectUri())) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Google Calendar OAuth no configurado");
        }
    }

    private Long parseUserId(String meta) {
        try {
            return Long.parseLong(meta);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId invalido en state");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String randomCodeVerifier() {
        byte[] bytes = new byte[64]; // genera longitud > 43 y < 128
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String toCodeChallenge(String codeVerifier) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(codeVerifier.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
