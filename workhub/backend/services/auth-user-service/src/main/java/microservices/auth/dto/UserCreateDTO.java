package microservices.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import microservices.auth.enums.UserRole;

public record UserCreateDTO(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Size(max = 120) String fullName,
        @NotNull UserRole role,
        @NotBlank @Size(min = 6, max = 120) String password
) {
}
