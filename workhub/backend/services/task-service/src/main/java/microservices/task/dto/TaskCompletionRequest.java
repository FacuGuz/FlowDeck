package microservices.task.dto;

import jakarta.validation.constraints.NotNull;

public record TaskCompletionRequest(
        @NotNull Long userId,
        @NotNull TaskCompletionAction action
) {
    public enum TaskCompletionAction {
        REQUEST,
        APPROVE,
        REJECT
    }
}
