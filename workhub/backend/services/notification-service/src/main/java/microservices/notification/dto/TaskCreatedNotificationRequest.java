package microservices.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record TaskCreatedNotificationRequest(
        @NotNull Long taskId,
        @NotNull Long assigneeId,
        @NotBlank @Size(max = 180) String taskTitle,
        @NotBlank @Size(max = 160) String teamName
) {
}
