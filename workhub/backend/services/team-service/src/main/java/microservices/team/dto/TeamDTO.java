package microservices.team.dto;

import java.time.OffsetDateTime;

public record TeamDTO(
        Long id,
        String name,
        OffsetDateTime createdAt
) {
}
