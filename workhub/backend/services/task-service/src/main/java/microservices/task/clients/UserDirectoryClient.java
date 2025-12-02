package microservices.task.clients;

import java.util.Optional;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

@Component
public class UserDirectoryClient {

    private static final Logger log = LoggerFactory.getLogger(UserDirectoryClient.class);

    private final RestTemplate restTemplate;
    private final String authServiceBaseUrl;

    public UserDirectoryClient(RestTemplate restTemplate,
                               @Value("${users.base-url}") String authServiceBaseUrl) {
        this.restTemplate = restTemplate;
        this.authServiceBaseUrl = authServiceBaseUrl;
    }

    public Optional<TeamMembershipResponse> getMembership(Long userId, Long teamId) {
        if (userId == null || teamId == null) {
            return Optional.empty();
        }
        try {
            ResponseEntity<TeamMembershipResponse> response = restTemplate.getForEntity(
                    authServiceBaseUrl + "/users/{userId}/teams/{teamId}",
                    TeamMembershipResponse.class,
                    Map.of("userId", userId, "teamId", teamId)
            );
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return Optional.of(response.getBody());
            }
        } catch (HttpClientErrorException.NotFound ex) {
            return Optional.empty();
        } catch (Exception ex) {
            log.warn("Failed to fetch membership for user {} in team {}: {}", userId, teamId, ex.getMessage());
        }
        return Optional.empty();
    }

    public record TeamMembershipResponse(Long id, Long userId, Long teamId, String role) {
    }
}
