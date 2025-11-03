package microservices.team.controllers;

import java.util.List;

import jakarta.validation.Valid;
import microservices.team.dto.TeamCreateDTO;
import microservices.team.dto.TeamDTO;
import microservices.team.dto.TeamMemberCreateDTO;
import microservices.team.dto.TeamMemberDTO;
import microservices.team.services.TeamService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/teams")
@Validated
public class TeamController {

    private final TeamService teamService;

    public TeamController(TeamService teamService) {
        this.teamService = teamService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TeamDTO createTeam(@Valid @RequestBody TeamCreateDTO request) {
        return teamService.createTeam(request);
    }

    @GetMapping
    public List<TeamDTO> listTeams() {
        return teamService.listTeams();
    }

    @GetMapping("/{id}")
    public TeamDTO getTeam(@PathVariable Long id) {
        return teamService.getTeam(id);
    }

    @GetMapping("/code/{code}")
    public TeamDTO getTeamByCode(@PathVariable String code) {
        return teamService.getTeamByCode(code);
    }

    @GetMapping("/{id}/members")
    public List<TeamMemberDTO> listMembers(@PathVariable Long id) {
        return teamService.listMembers(id);
    }

    @PostMapping("/{id}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public TeamMemberDTO addMember(@PathVariable Long id, @Valid @RequestBody TeamMemberCreateDTO request) {
        return teamService.addMember(id, request);
    }

    @DeleteMapping("/{teamId}/members/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@PathVariable Long teamId, @PathVariable Long memberId) {
        teamService.removeMember(teamId, memberId);
    }
}
