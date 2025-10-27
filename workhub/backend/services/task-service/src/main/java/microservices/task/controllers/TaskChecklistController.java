package microservices.task.controllers;

import java.util.List;

import jakarta.validation.Valid;
import microservices.task.dto.TaskChecklistItemCreateDTO;
import microservices.task.dto.TaskChecklistItemDTO;
import microservices.task.dto.TaskChecklistItemUpdateDTO;
import microservices.task.services.TaskChecklistService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/tasks/{taskId}/checklist")
@Validated
public class TaskChecklistController {

    private final TaskChecklistService checklistService;

    public TaskChecklistController(TaskChecklistService checklistService) {
        this.checklistService = checklistService;
    }

    @GetMapping
    public List<TaskChecklistItemDTO> list(@PathVariable Long taskId,
                                           @RequestParam(name = "includeArchived", defaultValue = "false") boolean includeArchived) {
        return checklistService.getList(taskId, includeArchived);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskChecklistItemDTO add(@PathVariable Long taskId,
                                    @Valid @RequestBody TaskChecklistItemCreateDTO request) {
        return checklistService.addItem(taskId, request);
    }

    @PatchMapping("/{itemId}")
    public TaskChecklistItemDTO update(@PathVariable Long taskId,
                                       @PathVariable Long itemId,
                                       @Valid @RequestBody TaskChecklistItemUpdateDTO request) {
        return checklistService.updateList(taskId, itemId, request);
    }

    @DeleteMapping("/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long taskId,
                       @PathVariable Long itemId,
                       @RequestParam(name = "hard", defaultValue = "false") boolean hardDelete) {
        checklistService.deleteItem(taskId, itemId, hardDelete);
    }
}
