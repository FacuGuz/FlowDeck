package microservices.auth.dto;

import microservices.auth.enums.UserRole;

import java.time.OffsetDateTime;

public record UserDTO(
        Long id,
        String email,
        String fullName,
        String nickname,
        String avatarUrl,
        UserRole role,
        OffsetDateTime createdAt
) {
}
