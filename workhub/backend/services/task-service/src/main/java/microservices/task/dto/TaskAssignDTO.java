package microservices.task.dto;

import jakarta.validation.constraints.NotNull;

public record TaskAssignDTO(
        @NotNull Long assigneeId
) {
}
