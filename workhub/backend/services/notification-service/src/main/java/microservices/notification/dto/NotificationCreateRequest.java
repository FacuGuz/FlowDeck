package microservices.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record NotificationCreateRequest(
        @NotNull Long userId,
        @NotBlank @Size(max = 160) String title,
        @NotBlank @Size(max = 2000) String message
) {
}
