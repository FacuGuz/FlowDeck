package microservices.auth.controllers;

import java.net.URI;
import microservices.auth.dto.OAuthLoginResponse;
import microservices.auth.dto.OAuthStartResponse;
import microservices.auth.oauth.GoogleOAuthService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping(value = "/oauth/google", produces = MediaType.APPLICATION_JSON_VALUE)
public class OAuthController {

    private final GoogleOAuthService googleOAuthService;

    public OAuthController(GoogleOAuthService googleOAuthService) {
        this.googleOAuthService = googleOAuthService;
    }

    @GetMapping("/start")
    public OAuthStartResponse start() {
        return googleOAuthService.start();
    }

    @GetMapping("/callback")
    public ResponseEntity<?> callback(@RequestParam String code,
                                      @RequestParam String state,
                                      @RequestParam(required = false) String redirect) {
        OAuthLoginResponse response = googleOAuthService.handleCallback(code, state);
        String target = (redirect != null && !redirect.isBlank())
                ? redirect
                : googleOAuthService.getFrontendRedirect();

        if (target != null && !target.isBlank()) {
            URI location = UriComponentsBuilder.fromUriString(target)
                    .queryParam("userId", response.user().id())
                    .queryParam("email", response.user().email())
                    .queryParam("fullName", response.user().fullName())
                    .queryParam("role", response.user().role())
                    .queryParam("createdAt", response.user().createdAt())
                    .queryParam("created", response.created())
                    .queryParam("refreshTokenStored", response.refreshTokenStored())
                    .encode()
                    .build()
                    .toUri();
            return ResponseEntity.status(302).location(location).build();
        }

        return ResponseEntity.ok(response);
    }
}
