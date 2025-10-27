package microservices.task.services;

import java.util.List;

import microservices.task.dto.TaskChecklistItemCreateDTO;
import microservices.task.dto.TaskChecklistItemDTO;
import microservices.task.dto.TaskChecklistItemUpdateDTO;
import microservices.task.entities.TaskChecklistItemEntity;
import microservices.task.entities.TaskEntity;
import microservices.task.repositories.TaskChecklistItemRepository;
import microservices.task.repositories.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TaskChecklistService {

    private final TaskRepository taskRepository;
    private final TaskChecklistItemRepository checklistItemRepository;

    public TaskChecklistService(TaskRepository taskRepository,
                                TaskChecklistItemRepository checklistItemRepository) {
        this.taskRepository = taskRepository;
        this.checklistItemRepository = checklistItemRepository;
    }

    @Transactional(readOnly = true)
    public List<TaskChecklistItemDTO> getList(Long taskId, boolean includeArchived) {
        checkTaskExists(taskId);
        List<TaskChecklistItemEntity> items = includeArchived
                ? checklistItemRepository.findAllByTaskId(taskId)
                : checklistItemRepository.findActiveByTaskId(taskId);
        return items
                .stream()
                .map(this::map)
                .toList();
    }

    @Transactional
    public TaskChecklistItemDTO addItem(Long taskId, TaskChecklistItemCreateDTO request) {
        TaskEntity task = checkTaskExists(taskId);
        int position = request.position() != null
                ? request.position()
                : task.getChecklistItems().size();

        TaskChecklistItemEntity entity = TaskChecklistItemEntity.builder()
                .title(request.title())
                .description(request.description())
                .completed(Boolean.TRUE.equals(request.completed()))
                .position(position)
                .archived(Boolean.TRUE.equals(request.archived()))
                .task(task)
                .build();

        task.addChecklistItem(entity);
        TaskChecklistItemEntity saved = checklistItemRepository.save(entity);
        return map(saved);
    }

    @Transactional
    public TaskChecklistItemDTO updateList(Long taskId, Long itemId, TaskChecklistItemUpdateDTO request) {
        TaskChecklistItemEntity entity = findChecklistItem(taskId, itemId);

        if (request.title() != null) {
            entity.setTitle(request.title());
        }
        if (request.description() != null) {
            entity.setDescription(request.description());
        }
        if (request.completed() != null) {
            entity.setCompleted(request.completed());
        }
        if (request.position() != null) {
            entity.setPosition(request.position());
        }
        if (request.archived() != null) {
            entity.setArchived(request.archived());
        }

        return map(entity);
    }

    @Transactional
    public void deleteItem(Long taskId, Long itemId, boolean hardDelete) {
        TaskChecklistItemEntity entity = findChecklistItem(taskId, itemId);
        if (hardDelete) {
            entity.getTask().removeChecklistItem(entity);
            checklistItemRepository.delete(entity);
        } else {
            entity.setArchived(true);
        }
    }

    private TaskEntity checkTaskExists(Long taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    }

    private TaskChecklistItemEntity findChecklistItem(Long taskId, Long itemId) {
        TaskChecklistItemEntity entity = checklistItemRepository.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Checklist item not found"));
        if (!entity.getTask().getId().equals(taskId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item does not belong to task");
        }
        return entity;
    }

    private TaskChecklistItemDTO map(TaskChecklistItemEntity entity) {
        return new TaskChecklistItemDTO(
                entity.getId(),
                entity.getTitle(),
                entity.getDescription(),
                entity.isCompleted(),
                entity.getPosition(),
                entity.isArchived(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
