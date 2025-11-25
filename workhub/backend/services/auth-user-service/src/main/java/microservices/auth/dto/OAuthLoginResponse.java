package microservices.auth.dto;

public record OAuthLoginResponse(
        UserDTO user,
        boolean created,
        boolean refreshTokenStored
) {
}
