package microservices.auth.services;

import java.util.List;

import microservices.auth.dto.UserCreateDTO;
import microservices.auth.dto.UserDTO;
import microservices.auth.dto.UserTeamCreateDTO;
import microservices.auth.dto.UserTeamDTO;
import microservices.auth.entities.UserEntity;
import microservices.auth.entities.UserTeamEntity;
import microservices.auth.enums.TeamRole;
import microservices.auth.enums.UserRole;
import microservices.auth.repositories.UserRepository;
import microservices.auth.repositories.UserTeamRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final UserTeamRepository userTeamRepository;

    public UserService(UserRepository userRepository, UserTeamRepository userTeamRepository) {
        this.userRepository = userRepository;
        this.userTeamRepository = userTeamRepository;
    }

    @Transactional
    public UserDTO createUser(UserCreateDTO request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        UserRole role = request.role() != null ? request.role() : UserRole.USER;

        UserEntity entity = UserEntity.builder()
                .email(request.email())
                .fullName(request.fullName())
                .role(role)
                .password(request.password())
                .build();

        UserEntity saved = userRepository.save(entity);
        return mapUser(saved);
    }

    @Transactional(readOnly = true)
    public List<UserDTO> getUsers() {
        return userRepository.findAll()
                .stream()
                .map(this::mapUser)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserDTO getUser(Long id) {
        return mapUser(findUserEntity(id));
    }

    @Transactional(readOnly = true)
    public List<UserTeamDTO> getUserTeams(Long userId) {
        findUserEntity(userId);
        return userTeamRepository.findByUser_Id(userId)
                .stream()
                .map(this::mapUserTeam)
                .toList();
    }

    @Transactional
    public UserTeamDTO addUserToTeam(Long userId, UserTeamCreateDTO request) {
        UserEntity user = findUserEntity(userId);

        if (userTeamRepository.existsByUser_IdAndTeamId(userId, request.teamId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already belongs to the team");
        }

        TeamRole teamRole = request.role() != null ? request.role() : TeamRole.MEMBER;

        UserTeamEntity relationship = UserTeamEntity.builder()
                .user(user)
                .teamId(request.teamId())
                .role(teamRole)
                .build();

        return mapUserTeam(userTeamRepository.save(relationship));
    }

    private UserEntity findUserEntity(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private UserDTO mapUser(UserEntity entity) {
        return new UserDTO(
                entity.getId(),
                entity.getEmail(),
                entity.getFullName(),
                entity.getRole(),
                entity.getPassword(),
                entity.getCreatedAt()
        );
    }

    private UserTeamDTO mapUserTeam(UserTeamEntity entity) {
        return new UserTeamDTO(
                entity.getId(),
                entity.getUser().getId(),
                entity.getTeamId(),
                entity.getRole(),
                entity.getCreatedAt()
        );
    }
}
