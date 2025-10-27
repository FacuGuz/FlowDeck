package microservices.task.services;

import java.util.ArrayList;
import java.util.List;

import microservices.task.dto.TaskAssignDTO;
import microservices.task.dto.TaskCreateDTO;
import microservices.task.dto.TaskDTO;
import microservices.task.dto.TaskChecklistItemCreateDTO;
import microservices.task.dto.TaskChecklistItemDTO;
import microservices.task.dto.TaskUpdateDTO;
import microservices.task.entities.TaskChecklistItemEntity;
import microservices.task.entities.TaskEntity;
import microservices.task.entities.TaskStatus;
import microservices.task.repositories.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Transactional
    public TaskDTO createTask(TaskCreateDTO request) {
        TaskEntity entity = TaskEntity.builder()
                .teamId(request.teamId())
                .title(request.title())
                .description(request.description())
                .status(request.status())
                .assigneeId(request.assigneeId())
                .createdBy(request.createdBy())
                .build();

        applyChecklist(entity, request.checklist());

        return map(taskRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> listTasks(Long teamId) {
        List<TaskEntity> tasks = (teamId != null)
                ? taskRepository.findByTeamId(teamId)
                : taskRepository.findAll();

        return tasks.stream()
                .map(this::map)
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskDTO getTask(Long id) {
        return map(findTask(id));
    }

    @Transactional
    public TaskDTO updateTask(Long id, TaskUpdateDTO request) {
        TaskEntity entity = findTask(id);

        if (request.title() != null) {
            entity.setTitle(request.title());
        }
        if (request.description() != null) {
            entity.setDescription(request.description());
        }
        if (request.status() != null) {
            entity.setStatus(request.status());
        }

        if (request.checklist() != null) {
            resetChecklist(entity, request.checklist());
        }

        return map(taskRepository.save(entity));
    }

    @Transactional
    public TaskDTO assignTask(Long id, TaskAssignDTO request) {
        TaskEntity entity = findTask(id);
        entity.setAssigneeId(request.assigneeId());
        return map(taskRepository.save(entity));
    }

    private TaskEntity findTask(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    }

    private TaskDTO map(TaskEntity entity) {
        TaskStatus status = entity.getStatus();
        List<TaskChecklistItemDTO> checklist = entity.getChecklistItems().stream()
                .filter(item -> !item.isArchived())
                .map(this::mapChecklistItem)
                .toList();
        return new TaskDTO(
                entity.getId(),
                entity.getTeamId(),
                entity.getTitle(),
                entity.getDescription(),
                status,
                entity.getAssigneeId(),
                entity.getCreatedBy(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                checklist
        );
    }

    private TaskChecklistItemDTO mapChecklistItem(TaskChecklistItemEntity entity) {
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

    private void applyChecklist(TaskEntity entity, List<TaskChecklistItemCreateDTO> checklist) {
        if (checklist == null || checklist.isEmpty()) {
            return;
        }
        for (int i = 0; i < checklist.size(); i++) {
            TaskChecklistItemCreateDTO itemDto = checklist.get(i);
            TaskChecklistItemEntity item = TaskChecklistItemEntity.builder()
                    .title(itemDto.title())
                    .description(itemDto.description())
                    .completed(Boolean.TRUE.equals(itemDto.completed()))
                    .position(itemDto.position() != null ? itemDto.position() : i)
                    .archived(Boolean.TRUE.equals(itemDto.archived()))
                    .build();
            entity.addChecklistItem(item);
        }
    }

    private void resetChecklist(TaskEntity entity, List<TaskChecklistItemCreateDTO> checklist) {
        List<TaskChecklistItemEntity> currentItems = new ArrayList<>(entity.getChecklistItems());
        currentItems.forEach(entity::removeChecklistItem);
        applyChecklist(entity, checklist);
    }
}
