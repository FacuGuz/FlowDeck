package microservices.auth;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import microservices.auth.config.GoogleOAuthProperties;

@SpringBootApplication
@EnableConfigurationProperties({GoogleOAuthProperties.class})
public class AuthUserServiceApplication {

	public static void main(String[] args) {
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
		SpringApplication.run(AuthUserServiceApplication.class, args);
	}

}
