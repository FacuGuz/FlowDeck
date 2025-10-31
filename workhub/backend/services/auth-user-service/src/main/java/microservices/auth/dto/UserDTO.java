package microservices.auth.dto;

import java.time.OffsetDateTime;

public record UserDTO(
        Long id,
        String email,
        String fullName,
        String role,
        String password,
        OffsetDateTime createdAt
) {
}
