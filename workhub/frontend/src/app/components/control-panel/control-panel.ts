import { AsyncPipe, NgClass, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  combineLatest,
  firstValueFrom,
  forkJoin,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TaskService } from '../../services/task.service';
import { TeamService } from '../../services/team.service';
import { ModalService } from '../../services/modal.service';
import { toFriendlyError } from '../../services/error.utils';
import { TaskStatus, TaskCreateRequest } from '../../interfaces/task';
import { Team } from '../../interfaces/team';
import { User, UserTeam } from '../../interfaces/user';
import { TeamRole } from '../../enums/team-role';
import { UserRole } from '../../enums/user-role';

type PanelForm = 'task' | 'team' | 'join';

interface TeamOption {
  team: Team;
  membershipRole: TeamRole;
}

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor, AsyncPipe, NgClass],
  templateUrl: './control-panel.html',
  styleUrl: './control-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlPanel {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly taskService = inject(TaskService);
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

  protected readonly taskStatuses: TaskStatus[] = [
    'TODO',
    'IN_PROGRESS',
    'BLOCKED',
    'DONE',
  ];




  protected activePanel: PanelForm | null = null;
  protected isProcessing = false;
  protected feedback: { type: 'success' | 'error'; text: string; } | undefined ;

  private currentUser: User | null = null;

  readonly createTaskForm = this.fb.group({
    teamId: this.fb.control<number | null>(null, {
      validators: Validators.required,
    }),
    title: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(180),
    ]),
    description: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(2000),
    ]),
    status: this.fb.nonNullable.control<TaskStatus>('TODO'),
  });

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

  openPanel(panel: PanelForm): void {
    if (!this.ensureAuthenticated()) {
      return;
    }

    this.activePanel = panel;
    this.isProcessing = false;

    switch (panel) {
      case 'task':
        this.createTaskForm.reset({
          teamId: null,
          title: '',
          description: '',
          status: 'TODO',
        });
        break;
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

  async submitCreateTask(): Promise<void> {
    if (this.createTaskForm.invalid) {
      this.createTaskForm.markAllAsTouched();
      return;
    }

    const user = this.currentUser;
    if (!user) {
      this.openLogin();
      return;
    }

    this.startProcessing();

    try {
      const { title, description, status } =
        this.createTaskForm.getRawValue();
      const teamIdControl = this.createTaskForm.controls.teamId;
      const teamId = teamIdControl.value;

      if (teamId == null) {
        teamIdControl.setErrors({ required: true });
        this.stopProcessing();
        return;
      }

      const payload: TaskCreateRequest = {
        teamId,
        title,
        description,
        createdBy: user.id,
        status: status ?? 'TODO',
      };

      await firstValueFrom(this.taskService.create(payload));

      this.createTaskForm.reset({
        teamId: null,
        title: '',
        description: '',
        status: 'TODO',
      });
      this.closePanel();
      this.setFeedback('success', 'Tarea creada correctamente.');
    } catch (error) {
      this.handleError(error);
    } finally {
      this.stopProcessing();
    }
  }

  trackTeamOption(_: number, option: TeamOption): number {
    return option.team.id;
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

  protected translateStatus(status: TaskStatus): string {
    switch (status) {
      case 'TODO':
        return 'Por hacer';
      case 'IN_PROGRESS':
        return 'En progreso';
      case 'BLOCKED':
        return 'Bloqueada';
      case 'DONE':
        return 'Completada';
      default:
        return status;
    }
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
