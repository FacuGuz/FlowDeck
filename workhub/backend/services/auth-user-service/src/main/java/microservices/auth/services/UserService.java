package microservices.auth.services;

import java.util.List;
import java.util.Optional;
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
import microservices.auth.dto.GoogleProfileDTO;
import java.util.UUID;
import java.time.OffsetDateTime;

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

    @Transactional
    public UserDTO findOrCreateFromGoogle(GoogleProfileDTO profile, String refreshToken) {
        return userRepository.findByEmailIgnoreCase(profile.email())
                .map(existing -> updateGoogleDataIfNeeded(existing, profile, refreshToken))
                .map(this::mapUser)
                .orElseGet(() -> {
                    UserEntity entity = UserEntity.builder()
                            .email(profile.email())
                            .fullName(profile.fullName())
                            .role(UserRole.USER)
                            .password(generatePlaceholderPassword())
                            .googleSub(profile.sub())
                            .googleRefreshToken(refreshToken)
                            .createdAt(OffsetDateTime.now())
                            .build();
                    return mapUser(userRepository.save(entity));
                });
    }

    @Transactional
    public void updateCalendarRefreshToken(Long userId, String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "refresh_token de Calendar requerido");
        }
        UserEntity entity = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        entity.setGoogleCalendarRefreshToken(refreshToken);
        userRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public String getCalendarRefreshToken(Long userId) {
        UserEntity entity = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        if (entity.getGoogleCalendarRefreshToken() == null || entity.getGoogleCalendarRefreshToken().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usuario sin vincular Google Calendar");
        }
        return entity.getGoogleCalendarRefreshToken();
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
    public Optional<UserDTO> findByEmailIgnoreCase(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .map(this::mapUser);
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

    @Transactional
    public void removeUserFromTeam(Long userId, Long teamId) {
        UserTeamEntity entity = userTeamRepository.findByUser_IdAndTeamId(userId, teamId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership not found"));
        userTeamRepository.delete(entity);
    }

    @Transactional
    public void removeUserTeamById(Long userTeamId) {
        if (!userTeamRepository.existsById(userTeamId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership not found");
        }
        userTeamRepository.deleteById(userTeamId);
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

    private UserEntity updateGoogleDataIfNeeded(UserEntity entity, GoogleProfileDTO profile, String refreshToken) {
        boolean dirty = false;
        if (entity.getGoogleSub() == null && profile.sub() != null) {
            entity.setGoogleSub(profile.sub());
            dirty = true;
        }
        if (refreshToken != null && !refreshToken.isBlank()) {
            entity.setGoogleRefreshToken(refreshToken);
            dirty = true;
        }
        if (entity.getFullName() == null || entity.getFullName().isBlank()) {
            entity.setFullName(profile.fullName());
            dirty = true;
        }
        return dirty ? userRepository.save(entity) : entity;
    }

    private String generatePlaceholderPassword() {
        return "oauth-" + UUID.randomUUID();
    }
}
