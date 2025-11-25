package microservices.auth.controllers;

import java.util.List;

import jakarta.validation.Valid;
import microservices.auth.dto.UserCreateDTO;
import microservices.auth.dto.UserDTO;
import microservices.auth.dto.UserTeamCreateDTO;
import microservices.auth.dto.UserTeamDTO;
import microservices.auth.services.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.DeleteMapping;

@RestController
@RequestMapping("/users")
@Validated
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDTO createUser(@Valid @RequestBody UserCreateDTO request) {
        return userService.createUser(request);
    }

    @GetMapping
    public List<UserDTO> getUsers() {
        return userService.getUsers();
    }

    @GetMapping("/{id}")
    public UserDTO getUser(@PathVariable Long id) {
        return userService.getUser(id);
    }

    @GetMapping("/{id}/teams")
    public List<UserTeamDTO> getUserTeams(@PathVariable Long id) {
        return userService.getUserTeams(id);
    }

    @PostMapping("/{id}/teams")
    @ResponseStatus(HttpStatus.CREATED)
    public UserTeamDTO addUserToTeam(@PathVariable Long id, @Valid @RequestBody UserTeamCreateDTO request) {
        return userService.addUserToTeam(id, request);
    }

    @DeleteMapping("/{id}/teams/{teamId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeUserFromTeam(@PathVariable Long id, @PathVariable Long teamId) {
        userService.removeUserFromTeam(id, teamId);
    }

    @DeleteMapping("/teams/{userTeamId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeUserTeamById(@PathVariable Long userTeamId) {
        userService.removeUserTeamById(userTeamId);
    }
}
