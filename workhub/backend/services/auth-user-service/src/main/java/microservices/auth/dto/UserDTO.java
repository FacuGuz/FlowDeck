package microservices.auth.dto;

import microservices.auth.enums.UserRole;

import java.time.OffsetDateTime;

public record UserDTO(
        Long id,
        String email,
        String fullName,
        UserRole role,
        String password,
        OffsetDateTime createdAt
) {
}
