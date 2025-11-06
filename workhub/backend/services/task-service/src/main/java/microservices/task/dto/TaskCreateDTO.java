package microservices.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;

import microservices.task.entities.TaskStatus;

public record TaskCreateDTO(
        @NotNull Long teamId,
        @NotBlank @Size(max = 180) String title,
        @NotBlank @Size(max = 2000) String description,
        TaskStatus status,
        OffsetDateTime dueOn,
        @NotNull Long createdBy,
        Long assigneeId,
        List<TaskChecklistItemCreateDTO> checklist
) {
}
