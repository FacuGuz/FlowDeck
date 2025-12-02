package microservices.auth.dto;

import jakarta.validation.constraints.Size;

public record UserProfileUpdateDTO(
        @Size(max = 60) String nickname
) {
}
