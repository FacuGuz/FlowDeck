package microservices.auth.repositories;

import java.util.List;

import microservices.auth.entities.UserTeamEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserTeamRepository extends JpaRepository<UserTeamEntity, Long> {

    List<UserTeamEntity> findByUser_Id(Long userId);

    boolean existsByUser_IdAndTeamId(Long userId, Long teamId);
}
