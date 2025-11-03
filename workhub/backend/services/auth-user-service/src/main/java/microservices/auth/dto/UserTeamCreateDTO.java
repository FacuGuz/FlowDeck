package microservices.auth.dto;

import jakarta.validation.constraints.NotNull;
import microservices.auth.enums.TeamRole;

public record UserTeamCreateDTO(
        @NotNull Long teamId,
        @NotNull TeamRole role
) {
}
