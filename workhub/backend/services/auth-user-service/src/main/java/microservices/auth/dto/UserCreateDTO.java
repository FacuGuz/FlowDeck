package microservices.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserCreateDTO(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Size(max = 120) String fullName,
        @NotBlank @Size(max = 50) String role,
        @NotBlank @Size(min = 6, max = 120) String password
) {
}
