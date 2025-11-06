package microservices.task.dto;

import java.time.OffsetDateTime;
import java.util.List;

import microservices.task.entities.TaskStatus;

public record TaskUpdateDTO(
        String title,
        String description,
        TaskStatus status,
        OffsetDateTime dueOn,
        List<TaskChecklistItemCreateDTO> checklist
) {
}
