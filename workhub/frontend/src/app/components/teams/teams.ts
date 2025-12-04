import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, firstValueFrom, forkJoin, map, of, BehaviorSubject, switchMap, from } from 'rxjs';
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
  leaderUserId: number | null;
  leaderName?: string;
  leaderNickname?: string | null;
  leaderAvatar?: string | null;
  leaderInitials?: string;
  members: {
    id: number;
    userId: number;
    fullName: string;
    nickname?: string | null;
    avatarUrl?: string | null;
    email: string;
    initials: string;
    createdAt: string;
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

  protected state$ = new BehaviorSubject<TeamsState>({ status: 'idle', teams: [] });

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
        if (u) {
          this.loadTeams(u.id);
        } else {
          this.state$.next({ status: 'idle', teams: [] });
        }
      });
  }

  refresh(): void {
    if (this.currentUserId) {
      this.loadTeams(this.currentUserId);
    }
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
    if (this.state$.value.status !== 'ready') {
      this.state$.next({ ...this.state$.value, status: 'loading' });
    }

    this.authService.getUserTeams(userId).pipe(
      switchMap(memberships => {
        if (memberships.length === 0) {
          return of<TeamWithMembers[]>([]);
        }

        const teamRequests = memberships.map(m =>
          this.teamService.get(m.teamId).pipe(
            catchError(() => of(null)), // si da 404 o error, descartamos
            map(team => ({ team, membership: m }))
          )
        );

        return forkJoin(teamRequests).pipe(
          map(results => results.filter((r): r is { team: Team; membership: any } => r !== null && r.team !== null)),
          switchMap(validResults => {
            if (!validResults.length) return of<TeamWithMembers[]>([]);

            const memberRequests = validResults.map(item =>
              this.teamService.listMembers(item.team.id).pipe(
                catchError(() => of([])),
                map(members => ({ ...item, members }))
              )
            );

            return forkJoin(memberRequests).pipe(
              switchMap(fullTeams => {
                if (!fullTeams.length) return of<TeamWithMembers[]>([]);

                const finalViewPromises = fullTeams.map(async (ft) => {
                const memberDetails = await Promise.all(ft.members.map(async (mem) => {
                  try {
                    const u = await firstValueFrom(this.authService.getUser(mem.userId));
                    return {
                      id: mem.id,
                      userId: u.id,
                      fullName: u.fullName,
                      nickname: u.nickname ?? null,
                      avatarUrl: u.avatarUrl ?? null,
                      email: u.email,
                      initials: this.getInitials(u.nickname && u.nickname.trim().length ? u.nickname : u.fullName),
                      createdAt: mem.createdAt
                    };
                  } catch { return null; }
                }));

                const uniqueMembers = new Map<number, NonNullable<typeof memberDetails[number]>>();
                memberDetails.forEach((m) => {
                  if (m && !uniqueMembers.has(m.userId)) {
                    uniqueMembers.set(m.userId, m);
                  }
                });

                const validMembers = Array.from(uniqueMembers.values());
                const orderedByJoinDate = [...validMembers].sort(
                  (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );

                const ownerMember =
                  ft.membership.role === 'OWNER'
                    ? orderedByJoinDate.find((m) => m.userId === ft.membership.userId) ?? orderedByJoinDate[0]
                    : orderedByJoinDate[0];

                  return {
                    team: ft.team,
                    membershipRole: ft.membership.role,
                    myTeamMemberId: ft.members.find(m => m.userId === userId)?.id ?? null,
                    leaderUserId: ownerMember?.userId ?? null,
                    leaderName: ownerMember?.nickname && ownerMember.nickname.trim().length ? ownerMember.nickname : ownerMember?.fullName,
                    leaderNickname: ownerMember?.nickname ?? null,
                    leaderAvatar: ownerMember?.avatarUrl ?? null,
                    leaderInitials: ownerMember?.initials,
                    members: validMembers
                  } as TeamWithMembers;
                });

                return from(Promise.all(finalViewPromises));
              })
            );
          })
        );
      }),
      catchError(err => {
        this.state$.next({ status: 'error', teams: [], error: toFriendlyError(err).message });
        return of<TeamWithMembers[]>([]);
      })
    ).subscribe(views => {
      this.state$.next({ status: 'ready', teams: views as TeamWithMembers[] });
    });
  }

  async submitCreateTeam() {
    if (this.createTeamForm.invalid) return;

    this.isProcessing = true;
    this.feedback = null;
    const { name } = this.createTeamForm.getRawValue();

    try {
      const team = await firstValueFrom(this.teamService.create({ name: name! }));
      if (this.currentUserId) {
        // Nos aseguramos de que el creador quede registrado como miembro real del team-service.
        await firstValueFrom(
          this.teamService.addMember(team.id, { userId: this.currentUserId }).pipe(
            catchError((err: any) => {
              // Si ya existe la membresía (poco probable), ignoramos el 409.
              if (err?.status === 409) return of(null);
              throw err;
            })
          )
        );
        await firstValueFrom(
          this.authService.addUserToTeam(this.currentUserId, {
            teamId: team.id,
            role: 'OWNER'
          }).pipe(
            catchError((err: any) => {
              if (err?.status === 409) return of(null);
              throw err;
            })
          )
        );
      }
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
      const team = await firstValueFrom(this.teamService.findByCode(code!));
      const alreadyInTeam = this.state$.value.teams.some((t) => t.team.id === team.id);
      if (alreadyInTeam) {
        this.setFeedback('error', 'ya formas parte de este equipo');
        this.isProcessing = false;
        return;
      }

      await firstValueFrom(
        this.teamService.addMember(team.id, { userId: this.currentUserId }).pipe(
          catchError((err: any) => {
            if (err?.status === 409) return of(null);
            throw err;
          })
        )
      );
      await firstValueFrom(
        this.authService.addUserToTeam(this.currentUserId, { teamId: team.id, role: 'MEMBER' }).pipe(
          catchError((err: any) => {
            if (err?.status === 409) return of(null);
            throw err;
          })
        )
      );

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
      if (this.currentUserId) {
        await firstValueFrom(this.authService.removeUserFromTeam(this.currentUserId, view.team.id));
      }

      const currentTeams = this.state$.value.teams;
      const filteredTeams = currentTeams.filter(t => t.team.id !== view.team.id);
      this.state$.next({ ...this.state$.value, teams: filteredTeams });

      this.setFeedback('success', 'Has salido del equipo');
      this.refresh();

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
      await firstValueFrom(this.teamService.deleteTeam(view.team.id));

      const currentTeams = this.state$.value.teams;
      const filteredTeams = currentTeams.filter(t => t.team.id !== view.team.id);
      this.state$.next({ ...this.state$.value, teams: filteredTeams });

      this.setFeedback('success', 'Equipo eliminado');
      this.refresh();
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

  protected getMemberDisplayName(member: { fullName: string; nickname?: string | null }): string {
    return member.nickname && member.nickname.trim().length ? member.nickname.trim() : member.fullName;
  }
}
