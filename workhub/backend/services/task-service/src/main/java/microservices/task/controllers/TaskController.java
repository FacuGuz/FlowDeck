package microservices.task.controllers;

import java.util.List;

import jakarta.validation.Valid;
import microservices.task.dto.TaskAssignDTO;
import microservices.task.dto.TaskCreateDTO;
import microservices.task.dto.TaskDTO;
import microservices.task.dto.TaskUpdateDTO;
import microservices.task.services.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
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
@RequestMapping("/tasks")
@Validated
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskDTO createTask(@Valid @RequestBody TaskCreateDTO request) {
        return taskService.createTask(request);
    }

    @GetMapping
    public List<TaskDTO> listTasks(
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) Long assigneeId
    ) {
        return taskService.listTasks(teamId, assigneeId);
    }

    @GetMapping("/{id}")
    public TaskDTO getTask(@PathVariable Long id) {
        return taskService.getTask(id);
    }

    @PatchMapping("/{id}")
    public TaskDTO updateTask(@PathVariable Long id, @Valid @RequestBody TaskUpdateDTO request) {
        return taskService.updateTask(id, request);
    }

    @PostMapping("/{id}/assign")
    public TaskDTO assignTask(@PathVariable Long id, @Valid @RequestBody TaskAssignDTO request) {
        return taskService.assignTask(id, request);
    }
}
