package microservices.team.services;

import java.util.List;

import microservices.team.dto.TeamCreateDTO;
import microservices.team.dto.TeamDTO;
import microservices.team.dto.TeamMemberCreateDTO;
import microservices.team.dto.TeamMemberDTO;
import microservices.team.entities.TeamEntity;
import microservices.team.entities.TeamMemberEntity;
import microservices.team.repositories.TeamMemberRepository;
import microservices.team.repositories.TeamRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TeamService {

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;

    public TeamService(TeamRepository teamRepository, TeamMemberRepository teamMemberRepository) {
        this.teamRepository = teamRepository;
        this.teamMemberRepository = teamMemberRepository;
    }

    @Transactional
    public TeamDTO createTeam(TeamCreateDTO request) {
        if (teamRepository.existsByName(request.name())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Team name already in use");
        }

        TeamEntity entity = TeamEntity.builder()
                .name(request.name())
                .build();

        return mapTeam(teamRepository.save(entity));
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

        if (teamMemberRepository.existsByTeam_IdAndUserId(teamId, request.userId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already belongs to team");
        }

        TeamMemberEntity entity = TeamMemberEntity.builder()
                .team(team)
                .userId(request.userId())
                .build();

        return mapMember(teamMemberRepository.save(entity));
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

    private TeamEntity findTeamEntity(Long id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team not found"));
    }

    private TeamDTO mapTeam(TeamEntity entity) {
        return new TeamDTO(entity.getId(), entity.getName(), entity.getCreatedAt());
    }

    private TeamMemberDTO mapMember(TeamMemberEntity entity) {
        return new TeamMemberDTO(
                entity.getId(),
                entity.getTeam().getId(),
                entity.getUserId(),
                entity.getCreatedAt()
        );
    }
}
