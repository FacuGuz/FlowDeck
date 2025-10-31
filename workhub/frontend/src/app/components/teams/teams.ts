import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe, NgFor, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, shareReplay, startWith, switchMap, catchError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TeamService } from '../../services/team.service';
import { Team } from '../../interfaces/team';
import { toFriendlyError } from '../../services/error.utils';
import { ModalService } from '../../services/modal.service';

interface TeamsViewState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  teams: Team[];
  error?: string;
}

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [NgIf, NgFor, AsyncPipe, DatePipe, NgSwitch, NgSwitchCase, NgSwitchDefault, RouterLink],
  templateUrl: './teams.html',
  styleUrl: './teams.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Teams {
  private readonly authService = inject(AuthService);
  private readonly teamService = inject(TeamService);
  private readonly modalService = inject(ModalService);

  protected readonly user$ = this.authService.currentUser$;
  protected readonly state$ = this.authService.currentUser$.pipe(
    switchMap((user) => {
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
            map((teams) => ({ status: 'ready', teams: teams.sort((a, b) => a.name.localeCompare(b.name)) } satisfies TeamsViewState))
          );
        }),
        startWith<TeamsViewState>({ status: 'loading', teams: [] })
      );
    }),
    catchError((error) => of<TeamsViewState>({ status: 'error', teams: [], error: toFriendlyError(error).message })),
    shareReplay(1)
  );

  trackByTeamId(_: number, team: Team): number {
    return team.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  openLoginModal(): void {
    this.modalService.open('login');
  }
}
