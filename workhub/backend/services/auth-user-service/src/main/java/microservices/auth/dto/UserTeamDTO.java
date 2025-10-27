package microservices.auth.dto;

import java.time.OffsetDateTime;

public record UserTeamDTO(
        Long id,
        Long userId,
        Long teamId,
        OffsetDateTime createdAt
) {
}
