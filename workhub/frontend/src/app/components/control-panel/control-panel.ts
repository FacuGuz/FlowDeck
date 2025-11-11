import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  forkJoin,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TeamService } from '../../services/team.service';
import { ModalService } from '../../services/modal.service';
import { toFriendlyError } from '../../services/error.utils';
import { Team } from '../../interfaces/team';
import { User, UserTeam } from '../../interfaces/user';
import { TeamRole } from '../../enums/team-role';
import { UserRole } from '../../enums/user-role';

interface TeamOption {
  team: Team;
  membershipRole: TeamRole;
}

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './control-panel.html',
  styleUrl: './control-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlPanel {
  private readonly authService = inject(AuthService);
  private readonly teamService = inject(TeamService);
  private readonly modalService = inject(ModalService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user$ = this.authService.currentUser$;

  private readonly refreshTeams$ = new BehaviorSubject<void>(undefined);

  protected readonly memberships$ = combineLatest([
    this.user$,
    this.refreshTeams$,
  ]).pipe(
    switchMap(([user]) => {
      if (!user) {
        return of<UserTeam[]>([]);
      }
      return this.authService.getUserTeams(user.id);
    }),
    shareReplay(1)
  );

  protected readonly teamOptions$ = this.memberships$.pipe(
    switchMap((memberships) => {
      if (!memberships.length) {
        return of<TeamOption[]>([]);
      }

      const requests = memberships.map((membership) =>
        this.teamService.get(membership.teamId).pipe(
          map((team) => ({
            team,
            membershipRole: membership.role,
          }))
        )
      );

      return forkJoin(requests).pipe(
        map((entries) =>
          entries.sort((a, b) => a.team.name.localeCompare(b.team.name))
        )
      );
    }),
    shareReplay(1)
  );

  protected feedback: { type: 'success' | 'error'; text: string; } | undefined ;
  private currentUser: User | null = null;

  constructor() {
    this.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.currentUser = user;
      });
  }

  openLogin(): void {
    this.modalService.open('login');
  }

  trackTeamOption(_: number, option: TeamOption): number {
    return option.team.id;
  }

  private setFeedback(type: 'success' | 'error', text: string): void {
    this.feedback = { type, text };
  }

  private handleError(error: unknown): void {
    const friendly = toFriendlyError(error);
    this.setFeedback('error', friendly.message);
  }

  protected translateTeamRole(role: TeamRole): string {
    switch (role) {
      case 'OWNER':
        return 'Propietario';
      case 'MANAGER':
        return 'Manager';
      case 'MEMBER':
        return 'Miembro';
      default:
        return role;
    }
  }

  protected translateUserRole(role: UserRole): string {
    switch (role) {
      case 'ADMIN':
        return 'Administrador';
      case 'USER':
      default:
        return 'Usuario';
    }
  }
}
