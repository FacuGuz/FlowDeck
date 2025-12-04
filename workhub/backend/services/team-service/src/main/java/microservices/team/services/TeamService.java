package microservices.team.services;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import microservices.team.dto.TeamCreateDTO;
import microservices.team.dto.TeamDTO;
import microservices.team.dto.TeamMemberCreateDTO;
import microservices.team.dto.TeamMemberDTO;
import microservices.team.entities.TeamEntity;
import microservices.team.entities.TeamMemberEntity;
import microservices.team.repositories.TeamMemberRepository;
import microservices.team.repositories.TeamRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.concurrent.ThreadLocalRandom;

@Service
public class TeamService {

    private static final int CODE_LENGTH = 6;
    private static final int LETTER_COUNT = 3;
    private static final int MAX_GENERATION_ATTEMPTS = 25;

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;

    public TeamService(TeamRepository teamRepository, TeamMemberRepository teamMemberRepository) {
        this.teamRepository = teamRepository;
        this.teamMemberRepository = teamMemberRepository;
    }

    @Transactional
    public TeamDTO createTeam(TeamCreateDTO request) {
        for (int attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
            String code = generateUniqueCode();
            try {
                TeamEntity entity = TeamEntity.builder()
                        .name(request.name())
                        .code(code)
                        .build();
                return mapTeam(teamRepository.save(entity));
            } catch (DataIntegrityViolationException ex) {
                // Code collision, retry with a new code
                if (attempt == MAX_GENERATION_ATTEMPTS - 1) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Team code already exists, try again");
                }
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to create team");
    }

    @Transactional(readOnly = true)
    public List<TeamDTO> listTeams() {
        return teamRepository.findAll().stream()
                .map(this::mapTeam)
                .toList();
    }

    @Transactional(readOnly = true)
    public TeamDTO getTeam(Long id) {
        return mapTeam(findTeamEntity(id));
    }

    @Transactional(readOnly = true)
    public TeamDTO getTeamByCode(String code) {
        String normalized = normalizeCode(code);
        if (normalized.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Team code is required");
        }

        Optional<TeamEntity> team = teamRepository.findByCode(normalized);
        return team.map(this::mapTeam)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team not found"));
    }

    @Transactional(readOnly = true)
    public List<TeamMemberDTO> listMembers(Long teamId) {
        findTeamEntity(teamId);
        return teamMemberRepository.findByTeam_Id(teamId)
                .stream()
                .map(this::mapMember)
                .toList();
    }

    @Transactional
    public TeamMemberDTO addMember(Long teamId, TeamMemberCreateDTO request) {
        TeamEntity team = findTeamEntity(teamId);

        if (request.userId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }

        // Idempotente: si ya existe, devuelve el miembro existente
        var existing = teamMemberRepository.findByTeam_IdAndUserId(teamId, request.userId());
        if (existing.isPresent()) {
            return mapMember(existing.get());
        }

        try {
            TeamMemberEntity entity = TeamMemberEntity.builder()
                    .team(team)
                    .userId(request.userId())
                    .build();
            return mapMember(teamMemberRepository.save(entity));
        } catch (DataIntegrityViolationException ex) {
            // Si por condición de carrera ya existe, retorna el existente
            return teamMemberRepository.findByTeam_IdAndUserId(teamId, request.userId())
                    .map(this::mapMember)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "User already belongs to team"));
        }
    }

    @Transactional
    public void removeMember(Long teamId, Long memberId) {
        TeamMemberEntity member = teamMemberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team member not found"));

        if (!member.getTeam().getId().equals(teamId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Member does not belong to the specified team");
        }

        teamMemberRepository.delete(member);
    }

    @Transactional
    public void removeMemberAsOwner(Long teamId, Long memberId) {
        // Alias de removeMember para uso desde el owner
        removeMember(teamId, memberId);
    }

    private TeamEntity findTeamEntity(Long id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team not found"));
    }

    @Transactional
    public void deleteTeam(Long teamId) {
        TeamEntity team = findTeamEntity(teamId);
        // Se borran los miembros antes para cumplir con la FK y luego eliminar el equipo
        teamMemberRepository.deleteAll(teamMemberRepository.findByTeam_Id(teamId));
        teamRepository.delete(team);
    }

    private TeamDTO mapTeam(TeamEntity entity) {
        return new TeamDTO(entity.getId(), entity.getName(), entity.getCode(), entity.getCreatedAt());
    }

    private TeamMemberDTO mapMember(TeamMemberEntity entity) {
        return new TeamMemberDTO(
                entity.getId(),
                entity.getTeam().getId(),
                entity.getUserId(),
                entity.getCreatedAt()
        );
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
    }

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
            String candidate = generateCode();
            if (!teamRepository.existsByCode(candidate)) {
                return candidate;
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to generate team code");
    }

    private String generateCode() {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        StringBuilder builder = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < LETTER_COUNT; i++) {
            builder.append((char) ('A' + random.nextInt(26)));
        }
        for (int i = LETTER_COUNT; i < CODE_LENGTH; i++) {
            builder.append(random.nextInt(10));
        }
        return builder.toString();
    }
}



