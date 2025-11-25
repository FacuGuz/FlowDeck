package microservices.auth.dto;

public record GoogleProfileDTO(
        String sub,
        String email,
        String fullName
) {
}
