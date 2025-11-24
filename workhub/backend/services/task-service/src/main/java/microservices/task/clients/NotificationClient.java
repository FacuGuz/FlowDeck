package microservices.task.clients;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class NotificationClient {

    private static final Logger log = LoggerFactory.getLogger(NotificationClient.class);

    private final RestTemplate restTemplate;
    private final String notificationsBaseUrl;

    public NotificationClient(RestTemplate restTemplate,
                              @Value("${notifications.base-url}") String notificationsBaseUrl) {
        this.restTemplate = restTemplate;
        this.notificationsBaseUrl = notificationsBaseUrl;
    }

    public void sendTaskCreated(TaskCreatedNotificationPayload payload) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<TaskCreatedNotificationPayload> request = new HttpEntity<>(payload, headers);
            ResponseEntity<Void> response = restTemplate.postForEntity(
                    notificationsBaseUrl + "/notifications/task-created",
                    request,
                    Void.class
            );
            if (!response.getStatusCode().is2xxSuccessful()) {
                log.warn("Notification service responded with status {}", response.getStatusCode());
            }
        } catch (Exception ex) {
            log.warn("Failed to send task-created notification: {}", ex.getMessage());
        }
    }

    public record TaskCreatedNotificationPayload(
            Long taskId,
            Long assigneeId,
            String taskTitle,
            String teamName
    ) {
    }
}
