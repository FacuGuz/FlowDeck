package microservices.auth.dto;

import java.time.LocalDate;

public record CalendarSyncRequest(
        Long userId,
        String teamName,
        String taskName,
        LocalDate date
) {
}

