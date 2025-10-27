package microservices.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@org.springframework.context.annotation.Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain filter(HttpSecurity http) throws Exception {
        http.csrf(csrf-> csrf.disable());
        http.authorizeHttpRequests(auth->auth.anyRequest().permitAll());
        return http.build();
    }
}
