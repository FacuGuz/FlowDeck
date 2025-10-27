package microservices.team.repositories;

import microservices.team.entities.TeamEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamRepository extends JpaRepository<TeamEntity, Long> {

    boolean existsByName(String name);
}
