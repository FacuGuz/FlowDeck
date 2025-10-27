package microservices.task.dto;

import java.time.OffsetDateTime;

public record TaskChecklistItemDTO(
        Long id,
        String title,
        String description,
        boolean completed,
        int position,
        boolean archived,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
