package microservices.task.services;

import java.util.List;

import microservices.task.dto.TaskAssignDTO;
import microservices.task.dto.TaskCreateDTO;
import microservices.task.dto.TaskDTO;
import microservices.task.dto.TaskUpdateDTO;
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
        return new TaskDTO(
                entity.getId(),
                entity.getTeamId(),
                entity.getTitle(),
                entity.getDescription(),
                status,
                entity.getAssigneeId(),
                entity.getCreatedBy(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
