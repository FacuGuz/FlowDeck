package microservices.task.dto;

import java.util.List;

import microservices.task.entities.TaskStatus;

public record TaskUpdateDTO(
        String title,
        String description,
        TaskStatus status,
        List<TaskChecklistItemCreateDTO> checklist
) {
}
