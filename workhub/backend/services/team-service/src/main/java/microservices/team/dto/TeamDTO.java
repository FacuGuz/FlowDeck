package microservices.team.dto;

import java.time.OffsetDateTime;

public record TeamDTO(
        Long id,
        String name,
        String code,
        OffsetDateTime createdAt
) {
}
