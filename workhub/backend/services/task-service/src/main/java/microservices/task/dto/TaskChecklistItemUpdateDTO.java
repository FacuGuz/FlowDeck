package microservices.task.dto;

import jakarta.validation.constraints.Size;

public record TaskChecklistItemUpdateDTO(
        @Size(max = 180) String title,
        @Size(max = 2000) String description,
        Boolean completed,
        Integer position,
        Boolean archived
) {
}
