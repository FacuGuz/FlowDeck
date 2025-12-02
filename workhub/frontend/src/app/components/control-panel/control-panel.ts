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
  throwError,
} from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TeamService } from '../../services/team.service';
import { ModalService } from '../../services/modal.service';
import { TaskService } from '../../services/task.service';
import { toFriendlyError } from '../../services/error.utils';
import { Team } from '../../interfaces/team';
import { User, UserTeam } from '../../interfaces/user';
import { Task, TaskStatus } from '../../interfaces/task';
import { TeamRole } from '../../enums/team-role';
import { UserRole } from '../../enums/user-role';

interface TeamOption {
  team: Team;
  membershipRole: TeamRole;
}

type RecentTaskView = {
  id: number;
  title: string;
  status: TaskStatus;
  teamId: number;
  teamName?: string;
  activityType: 'created' | 'updated';
  activityAt: string;
};

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
  private readonly taskService = inject(TaskService);
  private readonly modalService = inject(ModalService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user$ = this.authService.currentUser$;

  private readonly refreshTeams$ = new BehaviorSubject<void>(undefined);
  private readonly relativeTimeFormatter = new Intl.RelativeTimeFormat('es', {
    numeric: 'auto',
  });

  protected readonly memberships$ = combineLatest([
    this.user$,
    this.refreshTeams$,
  ]).pipe(
    switchMap(([user]) => {
      if (!user) {
        return of<UserTeam[]>([]);
      }
      return this.authService.getUserTeams(user.id).pipe(
        catchError((error) => {
          this.handleError(error);
          return of<UserTeam[]>([]);
        })
      );
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
          })),
          catchError((error) => {
            if (error && typeof error.message === 'string' && error.message.includes('404')) {
              console.warn('[ControlPanel] Equipo no encontrado, se omitirá', membership.teamId);
              return of<TeamOption | null>(null);
            }
            return throwError(() => error);
          })
        )
      );

      return forkJoin(requests).pipe(
        map((entries) =>
          entries
            .filter((entry): entry is TeamOption => entry !== null)
            .sort((a, b) => a.team.name.localeCompare(b.team.name))
        ),
        catchError((error) => {
          this.handleError(error);
          return of<TeamOption[]>([]);
        })
      );
    }),
    shareReplay(1)
  );

  protected readonly recentTasks$ = combineLatest([
    this.user$,
    this.memberships$,
    this.teamOptions$,
  ]).pipe(
    switchMap(([user, memberships, teamOptions]) => {
      if (!user || !memberships.length) {
        return of<RecentTaskView[]>([]);
      }

      const teamNameMap = new Map(
        teamOptions.map((option) => [option.team.id, option.team.name])
      );

      const requests = memberships.map((membership) =>
        this.taskService.list({ teamId: membership.teamId })
      );

      return forkJoin(requests).pipe(
        map((responses) => responses.flat()),
        map((tasks) => this.filterRecentTasks(tasks)),
        map((tasks) =>
          tasks
            .map((task) => this.toRecentTaskView(task, teamNameMap))
            .filter((view): view is RecentTaskView => view !== null)
            .sort(
              (a, b) => Date.parse(b.activityAt) - Date.parse(a.activityAt)
            )
        ),
        catchError((error) => {
          this.handleError(error);
          return of<RecentTaskView[]>([]);
        })
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

  protected describeActivity(activity: 'created' | 'updated'): string {
    return activity === 'updated' ? 'Actualizada' : 'Creada';
  }

  protected formatRelativeTime(iso: string): string {
    const timestamp = Date.parse(iso);
    if (Number.isNaN(timestamp)) {
      return 'hace poco';
    }

    const diffMs = timestamp - Date.now();
    const minutes = Math.round(diffMs / (1000 * 60));
    if (Math.abs(minutes) < 60) {
      return this.relativeTimeFormatter.format(minutes, 'minute');
    }

    const hours = Math.round(diffMs / (1000 * 60 * 60));
    if (Math.abs(hours) < 24) {
      return this.relativeTimeFormatter.format(hours, 'hour');
    }

    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return this.relativeTimeFormatter.format(days, 'day');
  }

  protected translateStatus(status: TaskStatus): string {
    switch (status) {
      case 'TODO':
        return 'Por hacer';
      case 'IN_PROGRESS':
        return 'En progreso';
      case 'BLOCKED':
        return 'Bloqueada';
      case 'PENDING_APPROVAL':
        return 'Pendiente de aprobación';
      case 'DONE':
        return 'Completada';
      default:
        return status;
    }
  }

  // --- NUEVOS MÉTODOS VISUALES PARA EL HTML ---

  // Obtiene las clases CSS para el badge de estado
  protected getStatusClasses(status: TaskStatus): string {
    switch (status) {
      case 'DONE':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'; // Verde
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 ring-blue-700/10'; // Azul
      case 'BLOCKED':
        return 'bg-rose-50 text-rose-700 ring-rose-600/10'; // Rojo
      case 'TODO':
      default:
        return 'bg-slate-50 text-slate-600 ring-slate-500/10'; // Gris
    }
  }

  // Obtiene el color del punto decorativo
  protected getDotColor(status: TaskStatus): string {
    switch (status) {
      case 'DONE': return 'bg-emerald-500';
      case 'IN_PROGRESS': return 'bg-blue-500';
      case 'BLOCKED': return 'bg-rose-500';
      default: return 'bg-slate-300';
    }
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

  private filterRecentTasks(tasks: Task[]): Task[] {
    const threshold = Date.now() - 24 * 60 * 60 * 1000;
    return tasks.filter((task) => this.getLatestActivityDate(task) >= threshold);
  }

  private toRecentTaskView(
    task: Task,
    teamNames: Map<number, string>
  ): RecentTaskView | null {
    if (!teamNames.has(task.teamId)) {
      return null;
    }
    const latestActivity = this.getLatestActivityDate(task);
    const createdAt = Date.parse(task.createdAt);
    const updatedAt = Date.parse(task.updatedAt);
    const hasUpdated =
      !Number.isNaN(updatedAt) && updatedAt >= (Number.isNaN(createdAt) ? 0 : createdAt);

    const activityAtIso =
      latestActivity > 0
        ? new Date(latestActivity).toISOString()
        : task.updatedAt || task.createdAt;

    return {
      id: task.id,
      title: task.title,
      status: task.status,
      teamId: task.teamId,
      teamName: teamNames.get(task.teamId),
      activityType: hasUpdated ? 'updated' : 'created',
      activityAt: activityAtIso,
    };
  }

  private getLatestActivityDate(task: Task): number {
    const createdAt = Date.parse(task.createdAt);
    const updatedAt = Date.parse(task.updatedAt);
    return Math.max(
      Number.isNaN(createdAt) ? 0 : createdAt,
      Number.isNaN(updatedAt) ? 0 : updatedAt
    );
  }
}
