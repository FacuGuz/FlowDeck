package microservices.task.dto;

import java.time.OffsetDateTime;
import java.util.List;

import microservices.task.entities.TaskStatus;

public record TaskDTO(
        Long id,
        Long teamId,
        String title,
        String description,
        TaskStatus status,
        Long assigneeId,
        Long createdBy,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<TaskChecklistItemDTO> checklist
) {
}
