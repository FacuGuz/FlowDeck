package microservices.team.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TeamCreateDTO(
        @NotBlank @Size(max = 120) String name
) {
}
