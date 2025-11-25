import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  forkJoin,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  firstValueFrom,
} from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TeamService } from '../../services/team.service';
import { Team, TeamMember } from '../../interfaces/team';
import { toFriendlyError } from '../../services/error.utils';
import { ModalService } from '../../services/modal.service';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { User, UserTeam } from '../../interfaces/user';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TeamRole } from '../../enums/team-role';

interface TeamsViewState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  teams: TeamCardView[];
  error?: string;
}

interface TeamMemberPreview {
  memberId: number;
  userId: number;
  fullName: string;
  initials: string;
}

interface TeamCardView {
  team: Team;
  members: TeamMemberPreview[];
  myTeamMemberId?: number;
  myUserTeamId?: number;
  membershipRole?: TeamRole;
  leaderName?: string;
  leaderInitials?: string;
}

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './teams.html',
  styleUrl: './teams.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Teams {
  private readonly authService = inject(AuthService);
  private readonly teamService = inject(TeamService);
  private readonly modalService = inject(ModalService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected expandedTeams = new Set<number>();

  protected readonly user$ = this.authService.currentUser$;

  protected activePanel: string | null = null;
  protected isProcessing = false;
  protected feedback: { type: 'success' | 'error'; text: string; } | undefined;
  private currentUser: User | null = null;
  protected currentUserId: number | undefined;

  private readonly refreshTeams$ = new BehaviorSubject<void>(undefined);

  readonly createTeamForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });

  readonly joinTeamForm = this.fb.nonNullable.group({
    code: [
      '',
      [Validators.required, Validators.pattern(/^[A-Za-z]{3}\d{3}$/)],
    ],
  });

  constructor() {
    this.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.currentUser = user;
        this.currentUserId = user?.id;
      });
  }

  protected readonly state$ = combineLatest([
    this.user$,
    this.refreshTeams$,
  ]).pipe(
    switchMap(([user]) => {
      if (!user) {
        return of<TeamsViewState>({ status: 'idle', teams: [] });
      }

      return this.authService.getUserTeams(user.id).pipe(
        switchMap((memberships) => {
          if (!memberships.length) {
            return of<TeamsViewState>({ status: 'ready', teams: [] });
          }

          const requests = memberships.map((membership) =>
            this.teamService.get(membership.teamId).pipe(
              map((team) => ({ team, membership })),
              catchError(() => {
                // Limpia la relación en auth si el equipo ya no existe
                if (membership.id != null) {
                  this.authService.removeUserTeamById(membership.id).subscribe({ next: () => {}, error: () => {} });
                }
                return of(null);
              })
            )
          );
          return forkJoin(requests).pipe(
            switchMap((entries) => {
              const valid = entries.filter((e): e is { team: Team; membership: UserTeam } => e != null);
              if (!valid.length) {
                return of<TeamsViewState>({ status: 'ready', teams: [] });
              }
              const sorted = valid
                .map((entry) => entry)
                .sort((a, b) => a.team.name.localeCompare(b.team.name));

              const withMembers$ = sorted.map((entry) =>
                this.loadTeamMembers(entry.team.id).pipe(
                  switchMap((members) => {
                    const myMembership = members.find((m) => m.userId === user.id);

                    // Si ya no es miembro, borra la relación en auth y no muestra la card
                    if (!myMembership) {
                      if (entry.membership.id != null) {
                        this.authService
                          .removeUserTeamById(entry.membership.id)
                          .subscribe({ next: () => {}, error: () => {} });
                      }
                      return of<TeamCardView | null>(null);
                    }

                    const leaderName = members.at(0)?.fullName ?? 'No asignado';
                    const leaderInitials = members.at(0)?.initials ?? '?';
                    return of<TeamCardView>({
                      team: entry.team,
                      members,
                      myTeamMemberId: myMembership.memberId,
                      myUserTeamId: entry.membership.id,
                      membershipRole: entry.membership.role,
                      leaderName,
                      leaderInitials,
                    });
                  })
                )
              );

              return forkJoin(withMembers$).pipe(
                map((entries) => {
                  const cards = entries.filter((e): e is TeamCardView => e !== null);
                  return { status: 'ready', teams: cards } satisfies TeamsViewState;
                })
              );
            })
          );
        }),
        startWith<TeamsViewState>({ status: 'loading', teams: [] })
      );
    }),
    catchError((error) => of<TeamsViewState>({ status: 'error', teams: [], error: toFriendlyError(error).message })),
    shareReplay(1)
  );

  trackByTeamId(_: number, card: TeamCardView): number {
    return card.team.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  openLoginModal(): void {
    this.modalService.open('login');
  }

  protected toggleTeamMembers(teamId: number): void {
    const next = new Set(this.expandedTeams);
    if (next.has(teamId)) {
      next.delete(teamId);
    } else {
      next.add(teamId);
    }
    this.expandedTeams = next;
  }

  protected refresh(): void {
    this.refreshTeams();
  }

  protected isTeamExpanded(teamId: number): boolean {
    return this.expandedTeams.has(teamId);
  }

  private loadTeamMembers(teamId: number) {
    return this.teamService.listMembers(teamId).pipe(
      switchMap((members: TeamMember[]) => {
        if (!members.length) {
          return of<TeamMemberPreview[]>([]);
        }

        const requests = members.map((member) =>
          this.authService.getUser(member.userId).pipe(
            map((user) => ({
              memberId: member.id,
              userId: member.userId,
              fullName: user.fullName,
              initials: this.buildInitials(user.fullName),
            }))
          )
        );

        return forkJoin(requests);
      }),
      catchError(() => of<TeamMemberPreview[]>([]))
    );
  }

  private buildInitials(fullName: string): string {
    if (!fullName?.trim()) {
      return '?';
    }
    const [firstWord] = fullName.trim().split(/\s+/);
    return firstWord ? firstWord.charAt(0).toUpperCase() : '?';
  }

  openPanel(panel: 'team' | 'join'): void {
    if (!this.ensureAuthenticated()) {
      return;
    }

    this.activePanel = panel;
    this.isProcessing = false;
    this.feedback = undefined;

    switch (panel) {
      case 'team':
        this.createTeamForm.reset({ name: '' });
        break;
      case 'join':
        this.joinTeamForm.reset({ code: '' });
        break;
    }
  }

  closePanel(): void {
    this.activePanel = null;
    this.isProcessing = false;
  }

  openLogin(): void {
    this.modalService.open('login');
  }

  async submitCreateTeam(): Promise<void> {
    if (this.createTeamForm.invalid) {
      this.createTeamForm.markAllAsTouched();
      return;
    }

    const user = this.currentUser;
    if (!user) {
      this.openLogin();
      return;
    }

    this.startProcessing();

    try {
      const { name } = this.createTeamForm.getRawValue();
      const team = await firstValueFrom(this.teamService.create({ name }));

      await firstValueFrom(
        forkJoin([
          this.teamService.addMember(team.id, { userId: user.id }),
          this.authService.addUserToTeam(user.id, {
            teamId: team.id,
            role: 'OWNER',
          }),
        ])
      );

      this.createTeamForm.reset({ name: '' });
      this.closePanel();
      this.setFeedback(
        'success',
        `Equipo "${team.name}" creado. Codigo: ${team.code}`
      );
      this.refreshTeams();
    } catch (error) {
      this.handleError(error);
    } finally {
      this.stopProcessing();
    }
  }

  async submitJoinTeam(): Promise<void> {
    if (this.joinTeamForm.invalid) {
      this.joinTeamForm.markAllAsTouched();
      return;
    }

    const user = this.currentUser;
    if (!user) {
      this.openLogin();
      return;
    }

    this.startProcessing();

    try {
      const rawCode = this.joinTeamForm.getRawValue().code;
      const code = rawCode.trim().toUpperCase();

      const team = await firstValueFrom(this.teamService.findByCode(code));

      await firstValueFrom(
        forkJoin([
          this.teamService.addMember(team.id, { userId: user.id }),
          this.authService.addUserToTeam(user.id, {
            teamId: team.id,
            role: 'MEMBER',
          }),
        ])
      );

      this.joinTeamForm.reset({ code: '' });
      this.closePanel();
      this.setFeedback('success', `Te uniste al equipo "${team.name}".`);
      this.refreshTeams();
    } catch (error) {
      this.handleError(error);
    } finally {
      this.stopProcessing();
    }
  }

  private ensureAuthenticated(): boolean {
    if (!this.currentUser) {
      this.openLogin();
      return false;
    }
    return true;
  }

  private refreshTeams(): void {
    this.refreshTeams$.next(undefined);
  }

  private startProcessing(): void {
    this.isProcessing = true;
    this.feedback = undefined;
  }

  private stopProcessing(): void {
    this.isProcessing = false;
  }

  private setFeedback(type: 'success' | 'error', text: string): void {
    this.feedback = { type, text };
  }

  private handleError(error: unknown): void {
    const friendly = toFriendlyError(error);
    this.setFeedback('error', friendly.message);
  }

  protected copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.setFeedback('success', `Codigo "${text}" copiado al portapapeles.`);

      setTimeout(() => {
        if (this.feedback && this.feedback.text.includes(text)) {
          this.feedback = undefined;
        }
      }, 3000);

    }).catch(err => {
      console.error('Error al copiar el codigo:', err);
      this.setFeedback('error', 'No se pudo copiar el codigo.');
    });
  }

  protected async leaveTeam(card: TeamCardView): Promise<void> {
    if (card.membershipRole === 'OWNER') {
      this.setFeedback('error', 'El propietario no puede salir del equipo. Usa eliminar equipo si deseas cerrarlo.');
      return;
    }

    const teamMemberId = card.myTeamMemberId;
    const userTeamId = card.myUserTeamId;

    if (!this.ensureAuthenticated()) {
      return;
    }

    this.startProcessing();
    try {
      const userId = this.currentUser?.id;
      await firstValueFrom(
        forkJoin([
          teamMemberId ? this.teamService.removeMember(card.team.id, teamMemberId) : of(null),
          userTeamId != null
            ? this.authService.removeUserTeamById(userTeamId)
            : userId != null
              ? this.authService.removeUserFromTeam(userId, card.team.id)
              : of(null),
        ])
      );

      this.setFeedback('success', `Saliste del equipo "${card.team.name}".`);
      this.refreshTeams();
    } catch (error) {
      // No muestres error si es 404 después de borrar (el backend ya lo sacó)
      const friendly = toFriendlyError(error);
      if (friendly.message && !friendly.message.includes('404')) {
        this.setFeedback('error', friendly.message);
      }
      this.refreshTeams();
    } finally {
      this.stopProcessing();
    }
  }

  protected async deleteTeam(card: TeamCardView): Promise<void> {
    if (card.membershipRole !== 'OWNER') {
      this.setFeedback('error', 'Solo el propietario puede eliminar el equipo.');
      return;
    }

    this.startProcessing();
    try {
      await firstValueFrom(this.teamService.deleteTeam(card.team.id));
      this.setFeedback('success', `Equipo "${card.team.name}" eliminado.`);
      this.refreshTeams();
    } catch (error) {
      const friendly = toFriendlyError(error);
      if (friendly.message && !friendly.message.includes('404')) {
        this.setFeedback('error', friendly.message);
      }
      this.refreshTeams();
    } finally {
      this.stopProcessing();
    }
  }

  protected async removeMemberFromTeam(team: TeamCardView, member: TeamMemberPreview): Promise<void> {
    if (team.membershipRole !== 'OWNER') {
      this.setFeedback('error', 'Solo el propietario puede quitar miembros.');
      return;
    }
    if (this.currentUserId === member.userId) {
      this.setFeedback('error', 'No puedes quitarte a ti mismo desde aquí. Usa Salir/Eliminar equipo.');
      return;
    }

    this.startProcessing();
    try {
      await firstValueFrom(this.teamService.removeMember(team.team.id, member.memberId));
      this.setFeedback('success', `Se quitó a ${member.fullName} del equipo "${team.team.name}".`);
      this.refreshTeams();
    } catch (error) {
      const friendly = toFriendlyError(error);
      if (friendly.message && !friendly.message.includes('404')) {
        this.setFeedback('error', friendly.message);
      }
      this.refreshTeams();
    } finally {
      this.stopProcessing();
    }
  }
}
