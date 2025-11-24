package microservices.notification.controllers;

import jakarta.validation.Valid;
import java.util.List;
import microservices.notification.dto.NotificationCreateRequest;
import microservices.notification.dto.NotificationDTO;
import microservices.notification.dto.TaskCreatedNotificationRequest;
import microservices.notification.services.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/notifications")
@Validated
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<NotificationDTO> list(@RequestParam(required = false) Long userId) {
        return notificationService.list(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationDTO create(@Valid @RequestBody NotificationCreateRequest request) {
        return notificationService.create(request);
    }

    @PostMapping("/task-created")
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationDTO notifyTaskCreated(@Valid @RequestBody TaskCreatedNotificationRequest request) {
        return notificationService.notifyTaskCreated(request);
    }

    @PostMapping("/{id}/read")
    public NotificationDTO markAsRead(@PathVariable Long id) {
        return notificationService.markAsRead(id);
    }
}
