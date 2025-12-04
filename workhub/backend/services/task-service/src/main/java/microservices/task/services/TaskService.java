package microservices.task.services;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import microservices.task.clients.NotificationClient;
import microservices.task.clients.TeamDirectoryClient;
import microservices.task.clients.UserDirectoryClient;
import microservices.task.dto.TaskAssignDTO;
import microservices.task.dto.TaskChecklistItemCreateDTO;
import microservices.task.dto.TaskChecklistItemDTO;
import microservices.task.dto.TaskCompletionRequest;
import microservices.task.dto.TaskCompletionRequest.TaskCompletionAction;
import microservices.task.dto.TaskCreateDTO;
import microservices.task.dto.TaskDTO;
import microservices.task.dto.TaskUpdateDTO;
import microservices.task.entities.TaskChecklistItemEntity;
import microservices.task.entities.TaskEntity;
import microservices.task.entities.TaskStatus;
import microservices.task.repositories.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TaskService {

    private static final Logger log = LoggerFactory.getLogger(TaskService.class);
    private static final String OWNER_ROLE = "OWNER";

    private final TaskRepository taskRepository;
    private final NotificationClient notificationClient;
    private final TeamDirectoryClient teamDirectoryClient;
    private final UserDirectoryClient userDirectoryClient;

    public TaskService(TaskRepository taskRepository,
                       NotificationClient notificationClient,
                       TeamDirectoryClient teamDirectoryClient,
                       UserDirectoryClient userDirectoryClient) {
        this.taskRepository = taskRepository;
        this.notificationClient = notificationClient;
        this.teamDirectoryClient = teamDirectoryClient;
        this.userDirectoryClient = userDirectoryClient;
    }

    @Transactional
    public TaskDTO createTask(TaskCreateDTO request) {
        ensureOwnerPermission(request.teamId(), request.createdBy(), "crear tareas");
        TaskStatus initialStatus = sanitizeInitialStatus(request.status());
        TaskEntity entity = TaskEntity.builder()
                .teamId(request.teamId())
                .title(request.title())
                .description(request.description())
                .status(initialStatus)
                .assigneeId(request.assigneeId())
                .dueOn(request.dueOn())
                .createdBy(request.createdBy())
                .build();

        applyChecklist(entity, request.checklist());

        TaskEntity saved = taskRepository.save(entity);
        notifyAssignee(saved);
        return map(saved);
    }

    @Transactional(readOnly = true)
    public List<TaskDTO> listTasks(Long teamId, Long assigneeId) {
        List<TaskEntity> tasks;
        if (teamId != null && assigneeId != null) {
            tasks = taskRepository.findByTeamIdAndAssigneeId(teamId, assigneeId);
        } else if (teamId != null) {
            tasks = taskRepository.findByTeamId(teamId);
        } else if (assigneeId != null) {
            tasks = taskRepository.findByAssigneeId(assigneeId);
        } else {
            tasks = taskRepository.findAll();
        }

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
            if (request.status() == TaskStatus.DONE || request.status() == TaskStatus.PENDING_APPROVAL) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado no editable manualmente");
            }
            entity.setStatus(request.status());
            clearApprovalMetadata(entity);
        }

        if (request.dueOn() != null) {
            entity.setDueOn(request.dueOn());
        }

        if (request.checklist() != null) {
            resetChecklist(entity, request.checklist());
        }

        return map(taskRepository.save(entity));
    }

    @Transactional
    public TaskDTO assignTask(Long id, TaskAssignDTO request) {
        TaskEntity entity = findTask(id);
        ensureOwnerPermission(entity.getTeamId(), request.requestedBy(), "asignar tareas");
        entity.setAssigneeId(request.assigneeId());
        TaskEntity saved = taskRepository.save(entity);
        notifyAssignee(saved);
        return map(saved);
    }

    @Transactional
    public TaskDTO handleCompletion(Long id, TaskCompletionRequest request) {
        if (request.userId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId requerido");
        }
        if (request.action() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Accion requerida");
        }

        TaskEntity entity = findTask(id);
        TaskEntity updated;
        TaskCompletionAction action = request.action();
        switch (action) {
            case REQUEST -> updated = requestCompletion(entity, request.userId());
            case APPROVE -> updated = approveCompletion(entity, request.userId());
            case REJECT -> updated = rejectCompletion(entity, request.userId());
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Accion invalida");
        }
        return map(updated);
    }

    @Transactional
    public void deleteTask(Long id, Long userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId requerido para eliminar tareas");
        }
        TaskEntity entity = findTask(id);
        boolean isCreator = entity.getCreatedBy() != null && entity.getCreatedBy().equals(userId);
        if (!isCreator) {
            ensureOwnerPermission(entity.getTeamId(), userId, "eliminar tareas");
        }
        taskRepository.delete(entity);
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
                entity.getDueOn(),
                entity.getCreatedBy(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getApprovalRequestedBy(),
                entity.getApprovalRequestedAt(),
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

    private TaskEntity requestCompletion(TaskEntity entity, Long userId) {
        Long assigneeId = entity.getAssigneeId();
        if (assigneeId == null || !assigneeId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el asignado puede marcar la tarea como completada");
        }
        if (entity.getStatus() == TaskStatus.DONE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La tarea ya fue completada");
        }
        if (entity.getStatus() == TaskStatus.PENDING_APPROVAL) {
            return entity;
        }
        entity.setPreviousStatus(entity.getStatus());
        entity.setStatus(TaskStatus.PENDING_APPROVAL);
        entity.setApprovalRequestedBy(userId);
        entity.setApprovalRequestedAt(OffsetDateTime.now());
        return taskRepository.save(entity);
    }

    private TaskEntity approveCompletion(TaskEntity entity, Long ownerId) {
        ensureOwnerPermission(entity.getTeamId(), ownerId, "aprobar tareas");
        if (entity.getStatus() != TaskStatus.DONE) {
            entity.setStatus(TaskStatus.DONE);
        }
        clearApprovalMetadata(entity);
        return taskRepository.save(entity);
    }

    private TaskEntity rejectCompletion(TaskEntity entity, Long ownerId) {
        ensureOwnerPermission(entity.getTeamId(), ownerId, "rechazar aprobaciones");
        if (entity.getStatus() != TaskStatus.PENDING_APPROVAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La tarea no esta pendiente de aprobacion");
        }
        TaskStatus fallback = entity.getPreviousStatus() != null ? entity.getPreviousStatus() : TaskStatus.TODO;
        if (fallback == TaskStatus.DONE || fallback == TaskStatus.PENDING_APPROVAL) {
            fallback = TaskStatus.TODO;
        }
        entity.setStatus(fallback);
        clearApprovalMetadata(entity);
        return taskRepository.save(entity);
    }

    private TaskStatus sanitizeInitialStatus(TaskStatus provided) {
        if (provided == null) {
            return TaskStatus.TODO;
        }
        if (provided == TaskStatus.DONE || provided == TaskStatus.PENDING_APPROVAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estado inicial no valido");
        }
        return provided;
    }

    private void ensureOwnerPermission(Long teamId, Long userId, String actionDescription) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId requerido para " + actionDescription);
        }
        Optional<UserDirectoryClient.TeamMembershipResponse> membership =
                userDirectoryClient.getMembership(userId, teamId);
        boolean isOwner = membership
                .map(member -> member.role() != null && OWNER_ROLE.equalsIgnoreCase(member.role()))
                .orElse(false);
        if (!isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo el owner del equipo puede " + actionDescription);
        }
    }

    private void clearApprovalMetadata(TaskEntity entity) {
        entity.setPreviousStatus(null);
        entity.setApprovalRequestedBy(null);
        entity.setApprovalRequestedAt(null);
    }

    private void notifyAssignee(TaskEntity task) {
        Long assigneeId = task.getAssigneeId();
        if (assigneeId == null) {
            return;
        }
        String teamName = teamDirectoryClient.getTeamName(task.getTeamId())
                .orElse("Equipo " + task.getTeamId());

        NotificationClient.TaskCreatedNotificationPayload payload =
                new NotificationClient.TaskCreatedNotificationPayload(
                        task.getId(),
                        assigneeId,
                        task.getTitle(),
                        teamName
                );
        log.debug("Sending notification for task {} to user {}", task.getId(), assigneeId);
        notificationClient.sendTaskCreated(payload);
    }
}
