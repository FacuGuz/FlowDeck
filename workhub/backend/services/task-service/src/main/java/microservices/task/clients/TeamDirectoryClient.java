package microservices.task.clients;

import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class TeamDirectoryClient {

    private static final Logger log = LoggerFactory.getLogger(TeamDirectoryClient.class);

    private final RestTemplate restTemplate;
    private final String teamServiceBaseUrl;

    public TeamDirectoryClient(RestTemplate restTemplate,
                               @Value("${teams.base-url}") String teamServiceBaseUrl) {
        this.restTemplate = restTemplate;
        this.teamServiceBaseUrl = teamServiceBaseUrl;
    }

    public Optional<String> getTeamName(Long teamId) {
        if (teamId == null) {
            return Optional.empty();
        }
        try {
            ResponseEntity<TeamResponse> response = restTemplate.getForEntity(
                    teamServiceBaseUrl + "/teams/{id}",
                    TeamResponse.class,
                    teamId
            );
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return Optional.ofNullable(response.getBody().name());
            }
        } catch (Exception ex) {
            log.warn("Failed to fetch team {} info: {}", teamId, ex.getMessage());
        }
        return Optional.empty();
    }

    record TeamResponse(Long id, String name) {
    }
}
