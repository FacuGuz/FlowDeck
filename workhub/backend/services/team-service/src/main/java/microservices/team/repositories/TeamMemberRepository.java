package microservices.team.repositories;

import java.util.List;

import microservices.team.entities.TeamMemberEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamMemberRepository extends JpaRepository<TeamMemberEntity, Long> {

    List<TeamMemberEntity> findByTeam_Id(Long teamId);

    boolean existsByTeam_IdAndUserId(Long teamId, Long userId);
}
