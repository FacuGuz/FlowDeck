package microservices.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GoogleTokenInfo(
        String aud,
        String email,
        @JsonProperty("email_verified") String emailVerified,
        String name,
        String sub
) {
    public boolean isEmailVerified() {
        return "true".equalsIgnoreCase(emailVerified) || "1".equals(emailVerified);
    }
}
