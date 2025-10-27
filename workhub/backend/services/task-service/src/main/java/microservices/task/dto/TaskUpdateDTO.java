package microservices.task.dto;

import microservices.task.entities.TaskStatus;

public record TaskUpdateDTO(
        String title,
        String description,
        TaskStatus status
) {
}
