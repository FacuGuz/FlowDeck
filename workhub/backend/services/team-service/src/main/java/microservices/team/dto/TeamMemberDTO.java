package microservices.team.dto;

import java.time.OffsetDateTime;

public record TeamMemberDTO(
        Long id,
        Long teamId,
        Long userId,
        OffsetDateTime createdAt
) {
}
