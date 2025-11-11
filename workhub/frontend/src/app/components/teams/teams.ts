// src/app/components/teams/teams.component.ts

import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  forkJoin,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  catchError,
  BehaviorSubject,
  firstValueFrom,
  combineLatest
} from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TeamService } from '../../services/team.service';
import { Team, TeamMember } from '../../interfaces/team';
import { toFriendlyError } from '../../services/error.utils';
import { ModalService } from '../../services/modal.service';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { User } from '../../interfaces/user';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
  protected feedback: { type: 'success' | 'error'; text: string; } | undefined ;
  private currentUser: User | null = null;

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

          const requests = memberships.map((membership) => this.teamService.get(membership.teamId));
          return forkJoin(requests).pipe(
            switchMap((teams) => {
              const sorted = teams.sort((a, b) => a.name.localeCompare(b.name));
              const withMembers$ = sorted.map((team) =>
                this.loadTeamMembers(team.id).pipe(
                  map((members) => ({ team, members }))
                )
              );

              return forkJoin(withMembers$).pipe(
                map((entries) => ({ status: 'ready', teams: entries } satisfies TeamsViewState))
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
      this.setFeedback('success', `Código "${text}" copiado al portapapeles.`);

      setTimeout(() => {
        if (this.feedback && this.feedback.text.includes(text)) {
          this.feedback = undefined;
        }
      }, 3000);

    }).catch(err => {
      console.error('Error al copiar el código:', err);
      this.setFeedback('error', 'No se pudo copiar el código.');
    });
  }
}
