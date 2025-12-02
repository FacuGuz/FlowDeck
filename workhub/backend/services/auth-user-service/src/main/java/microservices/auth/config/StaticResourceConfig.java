package microservices.auth.config;

import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {

    private final String uploadDir;

    public StaticResourceConfig(@Value("${user.avatar.upload-dir:uploads/avatars}") String uploadDir) {
        this.uploadDir = uploadDir;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path avatarPath = Path.of(uploadDir).toAbsolutePath().normalize();
        Path baseDir = avatarPath.getParent() != null ? avatarPath.getParent() : avatarPath;
        String absolute = baseDir.toUri().toString();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(absolute);
    }
}
