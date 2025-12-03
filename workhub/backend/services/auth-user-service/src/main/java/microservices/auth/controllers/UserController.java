package microservices.auth.controllers;

import java.io.IOException;
import java.util.List;

import jakarta.validation.Valid;
import microservices.auth.dto.LoginRequest;
import microservices.auth.dto.UserCreateDTO;
import microservices.auth.dto.UserDTO;
import microservices.auth.dto.UserProfileUpdateDTO;
import microservices.auth.dto.UserTeamCreateDTO;
import microservices.auth.dto.UserTeamDTO;
import microservices.auth.services.AvatarStorageService;
import microservices.auth.services.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/users")
@Validated
public class UserController {

    private final UserService userService;
    private final AvatarStorageService avatarStorageService;

    public UserController(UserService userService, AvatarStorageService avatarStorageService) {
        this.userService = userService;
        this.avatarStorageService = avatarStorageService;
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

    @PatchMapping("/{id}/profile")
    public UserDTO updateProfile(@PathVariable Long id, @Valid @RequestBody UserProfileUpdateDTO request) {
        return userService.updateProfile(id, request);
    }

    @PostMapping(value = "/{id}/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserDTO uploadAvatar(@PathVariable Long id, @RequestPart("file") MultipartFile file) throws IOException {
        String avatarUrl = avatarStorageService.save(file);
        return userService.updateAvatar(id, avatarUrl);
    }

    @GetMapping("/{id}/teams")
    public List<UserTeamDTO> getUserTeams(@PathVariable Long id) {
        return userService.getUserTeams(id);
    }

    @GetMapping("/{id}/teams/{teamId}")
    public UserTeamDTO getMembership(@PathVariable Long id, @PathVariable Long teamId) {
        return userService.getUserTeamMembership(id, teamId);
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

    @PostMapping("/login")
    public UserDTO login(@Valid @RequestBody LoginRequest request) {
        return userService.login(request.email(), request.password());
    }
}
