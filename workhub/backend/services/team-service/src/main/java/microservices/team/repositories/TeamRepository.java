package microservices.team.repositories;

import java.util.Optional;

import microservices.team.entities.TeamEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamRepository extends JpaRepository<TeamEntity, Long> {

    boolean existsByCode(String code);

    Optional<TeamEntity> findByCode(String code);
}
