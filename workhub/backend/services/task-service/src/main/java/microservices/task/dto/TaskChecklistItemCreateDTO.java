package microservices.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TaskChecklistItemCreateDTO(
        @NotBlank @Size(max = 180) String title,
        @Size(max = 2000) String description,
        Boolean completed,
        Integer position,
        Boolean archived
) {
}
