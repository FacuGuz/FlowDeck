package microservices.task.repositories;

import java.util.List;

import microservices.task.entities.TaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskRepository extends JpaRepository<TaskEntity, Long> {

    List<TaskEntity> findByTeamId(Long teamId);
}
