package microservices.auth.dto;

import jakarta.validation.constraints.NotNull;

public record UserTeamCreateDTO(
        @NotNull Long teamId
) {
}
