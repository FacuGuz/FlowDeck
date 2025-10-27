package microservices.team.dto;

import jakarta.validation.constraints.NotNull;

public record TeamMemberCreateDTO(
        @NotNull Long userId
) {
}
