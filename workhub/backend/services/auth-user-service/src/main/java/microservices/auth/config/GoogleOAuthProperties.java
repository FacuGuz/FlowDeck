package microservices.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "google.oauth")
public class GoogleOAuthProperties {

    private String clientId;
    private String clientSecret;
    private String redirectUri;
    private String scope = "openid email profile";
    private String authorizationUri = "https://accounts.google.com/o/oauth2/v2/auth";
    private String tokenUri = "https://oauth2.googleapis.com/token";
    private String tokenInfoUri = "https://oauth2.googleapis.com/tokeninfo";
    private String frontendRedirect = "http://localhost:4200/oauth/google/callback";
    // Config extra para Calendar
    private String calendarRedirectUri = "http://localhost:8081/oauth/google/calendar/callback";
    private String calendarScope = "https://www.googleapis.com/auth/calendar";
    private String calendarFrontendRedirect = "http://localhost:4200/calendario";

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
        this.clientSecret = clientSecret;
    }

    public String getRedirectUri() {
        return redirectUri;
    }

    public void setRedirectUri(String redirectUri) {
        this.redirectUri = redirectUri;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String scope) {
        this.scope = scope;
    }

    public String getAuthorizationUri() {
        return authorizationUri;
    }

    public void setAuthorizationUri(String authorizationUri) {
        this.authorizationUri = authorizationUri;
    }

    public String getTokenUri() {
        return tokenUri;
    }

    public void setTokenUri(String tokenUri) {
        this.tokenUri = tokenUri;
    }

    public String getTokenInfoUri() {
        return tokenInfoUri;
    }

    public void setTokenInfoUri(String tokenInfoUri) {
        this.tokenInfoUri = tokenInfoUri;
    }

    public String getFrontendRedirect() {
        return frontendRedirect;
    }

    public void setFrontendRedirect(String frontendRedirect) {
        this.frontendRedirect = frontendRedirect;
    }

    public String getCalendarRedirectUri() {
        return calendarRedirectUri;
    }

    public void setCalendarRedirectUri(String calendarRedirectUri) {
        this.calendarRedirectUri = calendarRedirectUri;
    }

    public String getCalendarScope() {
        return calendarScope;
    }

    public void setCalendarScope(String calendarScope) {
        this.calendarScope = calendarScope;
    }

    public String getCalendarFrontendRedirect() {
        return calendarFrontendRedirect;
    }

    public void setCalendarFrontendRedirect(String calendarFrontendRedirect) {
        this.calendarFrontendRedirect = calendarFrontendRedirect;
    }
}
