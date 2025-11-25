package microservices.auth.dto;

public record OAuthStartResponse(String authorizationUrl, String state) {
}
