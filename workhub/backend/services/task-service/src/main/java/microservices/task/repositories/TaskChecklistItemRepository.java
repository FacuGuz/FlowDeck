package microservices.task.repositories;

import java.util.List;

import microservices.task.entities.TaskChecklistItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskChecklistItemRepository extends JpaRepository<TaskChecklistItemEntity, Long> {

    @Query("select item from TaskChecklistItemEntity item where item.task.id = :taskId and item.archived = false order by item.position asc")
    List<TaskChecklistItemEntity> findActiveByTaskId(@Param("taskId") Long taskId);

    @Query("select item from TaskChecklistItemEntity item where item.task.id = :taskId order by item.position asc")
    List<TaskChecklistItemEntity> findAllByTaskId(@Param("taskId") Long taskId);

    boolean existsByTask_IdAndId(Long taskId, Long checklistItemId);
}
