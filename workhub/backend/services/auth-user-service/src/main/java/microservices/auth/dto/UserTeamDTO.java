package microservices.auth.dto;

import java.time.OffsetDateTime;

import microservices.auth.enums.TeamRole;

public record UserTeamDTO(
        Long id,
        Long userId,
        Long teamId,
        TeamRole role,
        OffsetDateTime createdAt
) {
}
