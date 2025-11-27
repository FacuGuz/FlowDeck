package microservices.auth.oauth;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import microservices.auth.config.GoogleOAuthProperties;
import microservices.auth.services.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class GoogleCalendarSyncService {

    private static final Logger log = LoggerFactory.getLogger(GoogleCalendarSyncService.class);
    private static final String EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

    private final GoogleOAuthProperties properties;
    private final UserService userService;
    private final RestTemplate restTemplate = new RestTemplate();

    public GoogleCalendarSyncService(GoogleOAuthProperties properties, UserService userService) {
        this.properties = properties;
        this.userService = userService;
    }

    public void createOrUpdateTaskEvent(Long userId, String teamName, String taskName, LocalDate date) {
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fecha requerida");
        }
        String refreshToken = userService.getCalendarRefreshToken(userId);
        String accessToken = refreshAccessToken(refreshToken);

        String summary = String.format("[%s] %s", safe(teamName), safe(taskName));

        Map<String, Object> body = Map.of(
                "summary", summary,
                "description", "Tarea asignada desde FlowDeck",
                "start", Map.of("date", date.format(DateTimeFormatter.ISO_DATE)),
                "end", Map.of("date", date.plusDays(1).format(DateTimeFormatter.ISO_DATE))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<String> response = restTemplate.exchange(
                EVENTS_ENDPOINT,
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class
        );

        if (!response.getStatusCode().is2xxSuccessful()) {
            log.error("Error creando evento en Calendar: {}", response.getBody());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo crear el evento en Google Calendar");
        }
    }

    private String refreshAccessToken(String refreshToken) {
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("client_id", properties.getClientId());
        body.add("client_secret", properties.getClientSecret());
        body.add("refresh_token", refreshToken);
        body.add("grant_type", "refresh_token");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        ResponseEntity<Map> resp = restTemplate.postForEntity(
                properties.getTokenUri(),
                new HttpEntity<>(body, headers),
                Map.class
        );

        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null || resp.getBody().get("access_token") == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo renovar el access_token de Calendar");
        }
        return resp.getBody().get("access_token").toString();
    }

    private String safe(String value) {
        return value == null || value.isBlank() ? "Tarea" : value;
    }
}

