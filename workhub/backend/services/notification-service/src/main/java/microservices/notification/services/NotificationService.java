package microservices.notification.services;

import java.util.List;
import microservices.notification.dto.NotificationCreateRequest;
import microservices.notification.dto.NotificationDTO;
import microservices.notification.dto.TaskCreatedNotificationRequest;
import microservices.notification.entities.NotificationEntity;
import microservices.notification.repositories.NotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public List<NotificationDTO> list(Long userId) {
        List<NotificationEntity> notifications = userId != null
                ? notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                : notificationRepository.findAllByOrderByCreatedAtDesc();
        return notifications.stream()
                .map(this::map)
                .toList();
    }

    @Transactional
    public NotificationDTO create(NotificationCreateRequest request) {
        NotificationEntity entity = NotificationEntity.builder()
                .userId(request.userId())
                .title(request.title())
                .message(request.message())
                .build();
        return map(notificationRepository.save(entity));
    }

    @Transactional
    public NotificationDTO notifyTaskCreated(TaskCreatedNotificationRequest request) {
        String title = "Nueva tarea asignada";
        String message = String.format(
                "Se creó la tarea \"%s\" en el equipo %s y se te asignó.",
                request.taskTitle(),
                request.teamName()
        );

        NotificationCreateRequest createRequest = new NotificationCreateRequest(
                request.assigneeId(),
                title,
                message
        );
        return create(createRequest);
    }

    @Transactional
    public NotificationDTO markAsRead(Long id) {
        NotificationEntity entity = findNotification(id);
        if (!entity.isRead()) {
            entity.setRead(true);
            entity = notificationRepository.save(entity);
        }
        return map(entity);
    }

    private NotificationEntity findNotification(Long id) {
        return notificationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
    }

    private NotificationDTO map(NotificationEntity entity) {
        return new NotificationDTO(
                entity.getId(),
                entity.getUserId(),
                entity.getTitle(),
                entity.getMessage(),
                entity.isRead(),
                entity.getCreatedAt()
        );
    }
}
