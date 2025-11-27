package microservices.auth.controllers;

import java.time.LocalDate;
import microservices.auth.dto.CalendarSyncRequest;
import microservices.auth.oauth.GoogleCalendarSyncService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/calendar/google", produces = MediaType.APPLICATION_JSON_VALUE)
public class CalendarController {

    private final GoogleCalendarSyncService calendarSyncService;

    public CalendarController(GoogleCalendarSyncService calendarSyncService) {
        this.calendarSyncService = calendarSyncService;
    }

    @PostMapping("/sync-task")
    public ResponseEntity<?> syncTask(@RequestBody CalendarSyncRequest request) {
        calendarSyncService.createOrUpdateTaskEvent(
                request.userId(),
                request.teamName(),
                request.taskName(),
                request.date()
        );
        return ResponseEntity.ok().build();
    }
}

