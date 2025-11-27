import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, combineLatest, firstValueFrom, forkJoin, map, of, switchMap, BehaviorSubject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../services/auth.service';
import { TeamService } from '../../services/team.service';
import { ModalService } from '../../services/modal.service';
import { toFriendlyError } from '../../services/error.utils';
import { Team } from '../../interfaces/team';
import { TeamRole } from '../../enums/team-role';

interface TeamWithMembers {
  team: Team;
  membershipRole: TeamRole | null;
  myTeamMemberId: number | null;
  leaderName?: string;
  leaderInitials?: string;
  members: {
    id: number;
    userId: number;
    fullName: string;
    email: string;
    initials: string;
  }[];
}

interface TeamsState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  teams: TeamWithMembers[];
  error?: string;
}

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './teams.html',
})
export class Teams implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly teamService = inject(TeamService);
  private readonly modalService = inject(ModalService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly refreshSignal$ = new BehaviorSubject<void>(undefined);

  protected readonly state$ = combineLatest([
    this.authService.currentUser$,
    this.refreshSignal$,
  ]).pipe(
    switchMap(([user]) => {
      if (!user) {
        return of<TeamsState>({ status: 'idle', teams: [] });
      }
      return this.loadTeams(user.id);
    }),
    takeUntilDestroyed()
  );

  protected activePanel: 'team' | 'join' | null = null;
  protected isProcessing = false;
  protected feedback: { type: 'success' | 'error'; text: string } | null = null;
  protected currentUserId: number | null = null;

  protected expandedTeamIds = new Set<number>();

  protected createTeamForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
  });

  protected joinTeamForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  ngOnInit() {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((u) => {
        this.currentUserId = u ? u.id : null;
      });
  }

  refresh(): void {
    this.refreshSignal$.next();
  }

  openPanel(panel: 'team' | 'join'): void {
    this.activePanel = panel;
    this.feedback = null;
    this.createTeamForm.reset();
    this.joinTeamForm.reset();
  }

  closePanel(): void {
    this.activePanel = null;
    this.isProcessing = false;
  }

  openLoginModal(): void {
    this.modalService.open('login');
  }

  toggleTeamExpansion(teamId: number): void {
    if (this.expandedTeamIds.has(teamId)) {
      this.expandedTeamIds.delete(teamId);
    } else {
      this.expandedTeamIds.add(teamId);
    }
  }

  isTeamExpanded(teamId: number): boolean {
    return this.expandedTeamIds.has(teamId);
  }

  copyToClipboard(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.setFeedback('success', 'Código copiado');
    });
  }

  private loadTeams(userId: number) {
    return this.authService.getUserTeams(userId).pipe(
      switchMap((memberships) => {
        if (memberships.length === 0) {
          return of<TeamsState>({ status: 'ready', teams: [] });
        }

        const requests = memberships.map((m) =>
          this.teamService.get(m.teamId).pipe(
            switchMap((team) =>
              this.teamService.listMembers(team.id).pipe(
                switchMap((members) => {
                  const memberRequests = members.map((mem) =>
                    this.authService.getUser(mem.userId).pipe(
                      map((u) => ({
                        id: mem.id,
                        userId: u.id,
                        fullName: u.fullName,
                        email: u.email,
                        initials: this.getInitials(u.fullName),
                      })),
                      catchError(() => of(null))
                    )
                  );
                  return forkJoin(memberRequests).pipe(
                    map((userDetails) => ({
                      team,
                      members: userDetails.filter((u): u is NonNullable<typeof u> => u !== null),
                    }))
                  );
                }),
                map(({ team, members }) => {
                  const myMembership = memberships.find((x) => x.teamId === team.id);
                  const leader = members[0];

                  return {
                    team,
                    membershipRole: myMembership?.role ?? null,
                    myTeamMemberId: members.find((mem) => mem.userId === userId)?.id ?? null,
                    leaderName: leader?.fullName,
                    leaderInitials: leader?.initials,
                    members,
                  } as TeamWithMembers;
                })
              )
            ),
            catchError(() => of(null))
          )
        );

        return forkJoin(requests).pipe(
          map((results) => {
            const validTeams = results.filter((t): t is TeamWithMembers => t !== null);
            return { status: 'ready', teams: validTeams } as TeamsState;
          })
        );
      }),
      map((state) => ({ ...state, status: 'ready' } as TeamsState)),
      catchError((err) =>
        of<TeamsState>({
          status: 'error',
          teams: [],
          error: toFriendlyError(err).message,
        })
      )
    );
  }

  async submitCreateTeam() {
    if (this.createTeamForm.invalid) return;

    this.isProcessing = true;
    this.feedback = null;
    const { name } = this.createTeamForm.getRawValue();

    try {
      // 1. Create solo acepta 'name' en tu servicio.
      await firstValueFrom(this.teamService.create({ name: name! }));
      this.setFeedback('success', 'Equipo creado correctamente');
      this.closePanel();
      this.refresh();
    } catch (err) {
      this.setFeedback('error', toFriendlyError(err).message);
    } finally {
      this.isProcessing = false;
    }
  }

  async submitJoinTeam() {
    if (this.joinTeamForm.invalid) return;
    if (!this.currentUserId) return;

    this.isProcessing = true;
    this.feedback = null;
    const { code } = this.joinTeamForm.getRawValue();

    try {
      // 1. Buscar equipo por código (Tu servicio tiene findByCode)
      const team = await firstValueFrom(this.teamService.findByCode(code!));

      // 2. Agregar miembro al equipo encontrado (Tu servicio tiene addMember)
      await firstValueFrom(this.teamService.addMember(team.id, { userId: this.currentUserId }));

      this.setFeedback('success', 'Te has unido al equipo');
      this.closePanel();
      this.refresh();
    } catch (err) {
      this.setFeedback('error', toFriendlyError(err).message);
    } finally {
      this.isProcessing = false;
    }
  }

  async leaveTeam(view: TeamWithMembers) {
    if (!view.myTeamMemberId) return;
    if (!confirm(`¿Salir de ${view.team.name}?`)) return;

    this.isProcessing = true;
    try {
      await firstValueFrom(this.teamService.removeMember(view.team.id, view.myTeamMemberId));
      this.refresh();
      this.setFeedback('success', 'Has salido del equipo');
    } catch (err) {
      this.setFeedback('error', toFriendlyError(err).message);
    } finally {
      this.isProcessing = false;
    }
  }

  async deleteTeam(view: TeamWithMembers) {
    if (!confirm(`¿ELIMINAR ${view.team.name}? Esta acción no se puede deshacer.`)) return;

    this.isProcessing = true;
    try {
      // Usamos deleteTeam que SI existe en tu servicio
      await firstValueFrom(this.teamService.deleteTeam(view.team.id));
      this.refresh();
      this.setFeedback('success', 'Equipo eliminado');
    } catch (err) {
      this.setFeedback('error', toFriendlyError(err).message);
    } finally {
      this.isProcessing = false;
    }
  }

  async removeMemberFromTeam(view: TeamWithMembers, member: any) {
    if (!confirm(`¿Expulsar a ${member.fullName}?`)) return;

    this.isProcessing = true;
    try {
      await firstValueFrom(this.teamService.removeMember(view.team.id, member.id));
      this.refresh();
    } catch (err) {
      alert(toFriendlyError(err).message);
    } finally {
      this.isProcessing = false;
    }
  }

  private setFeedback(type: 'success' | 'error', text: string) {
    this.feedback = { type, text };
    if (type === 'success') {
      setTimeout(() => (this.feedback = null), 4000);
    }
  }

  private getInitials(name: string): string {
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  }
}
