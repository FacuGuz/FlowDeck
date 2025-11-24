package microservices.notification.dto;

import java.time.OffsetDateTime;

public record NotificationDTO(
        Long id,
        Long userId,
        String title,
        String message,
        boolean read,
        OffsetDateTime createdAt
) {
}
