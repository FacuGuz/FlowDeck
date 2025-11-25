package microservices.auth.repositories;

import java.util.Optional;
import microservices.auth.entities.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

    boolean existsByEmail(String email);

    Optional<UserEntity> findByEmailIgnoreCase(String email);
}
