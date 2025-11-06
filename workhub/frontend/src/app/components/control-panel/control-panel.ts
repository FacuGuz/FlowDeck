import { AsyncPipe, NgClass, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  forkJoin,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TaskService } from '../../services/task.service';
import { TeamService } from '../../services/team.service';
import { ModalService } from '../../services/modal.service';
import { toFriendlyError } from '../../services/error.utils';
import { TaskStatus, TaskCreateRequest } from '../../interfaces/task';
import { Team, TeamMember } from '../../interfaces/team';
import { User, UserTeam } from '../../interfaces/user';
import { TeamRole } from '../../enums/team-role';
import { UserRole } from '../../enums/user-role';

type PanelForm = 'task' | 'team' | 'join';

interface TeamOption {
  team: Team;
  membershipRole: TeamRole;
}

interface TeamMemberOption {
  memberId: number;
  userId: number;
  fullName: string;
  email: string;
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
    assigneeId: this.fb.control<number | null>(null),
    dueOn: this.fb.control<string | null>(null),
    checklist: this.fb.array<FormGroup>([]),
  });

  protected get checklist(): FormArray<FormGroup> {
    return this.createTaskForm.controls.checklist as FormArray<FormGroup>;
  }

  protected get checklistControls(): FormGroup[] {
    return this.checklist.controls as FormGroup[];
  }

  protected readonly teamMembers$ = this.createTaskForm.controls.teamId.valueChanges.pipe(
    startWith(this.createTaskForm.controls.teamId.value),
    distinctUntilChanged(),
    switchMap((teamId) => {
      if (teamId == null) {
        return of<TeamMemberOption[]>([]);
      }

      return this.teamService.listMembers(teamId).pipe(
        switchMap((members: TeamMember[]) => {
          if (!members.length) {
            return of<TeamMemberOption[]>([]);
          }

          const requests = members.map((member) =>
            this.authService.getUser(member.userId).pipe(
              map((user) => ({
                memberId: member.id,
                userId: member.userId,
                fullName: user.fullName,
                email: user.email,
              }))
            )
          );

          return forkJoin(requests);
        }),
        catchError((error) => {
          this.handleError(error);
          return of<TeamMemberOption[]>([]);
        })
      );
    }),
    shareReplay(1)
  );

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

    this.createTaskForm.controls.teamId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.createTaskForm.controls.assigneeId.setValue(null);
      });

    this.resetChecklist();
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
          assigneeId: null,
          dueOn: null,
        });
        this.resetChecklist();
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
      const { title, description, status, assigneeId, dueOn, checklist } =
        this.createTaskForm.getRawValue();
      const teamIdControl = this.createTaskForm.controls.teamId;
      const teamId = teamIdControl.value;

      if (teamId == null) {
        teamIdControl.setErrors({ required: true });
        this.stopProcessing();
        return;
      }

      const dueOnIso = dueOn ? `${dueOn}T00:00:00Z` : null;

      const checklistPayload =
        (checklist ?? [])
          .map((item, index) => {
            const title = (item?.['title'] ?? '').trim();
            if (!title) {
              return null;
            }
            const description = (item?.['description'] ?? '').trim();
            return {
              title,
              description: description || undefined,
              completed: Boolean(item?.['completed']),
              position: index,
              archived: false,
            };
          })
          .filter((value): value is NonNullable<typeof value> => value != null);

      const payload: TaskCreateRequest = {
        teamId,
        title,
        description,
        createdBy: user.id,
        status: status ?? 'TODO',
        assigneeId: assigneeId ?? undefined,
        dueOn: dueOnIso,
        checklist: checklistPayload.length ? checklistPayload : undefined,
      };

      await firstValueFrom(this.taskService.create(payload));

      this.createTaskForm.reset({
        teamId: null,
        title: '',
        description: '',
        status: 'TODO',
        assigneeId: null,
        dueOn: null,
      });
      this.resetChecklist();
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

  protected addChecklistItem(initial?: {
    title?: string;
    description?: string;
    completed?: boolean;
  }): void {
    this.checklist.push(this.createChecklistItemGroup(initial));
  }

  protected removeChecklistItem(index: number): void {
    if (index < 0 || index >= this.checklist.length) {
      return;
    }
    this.checklist.removeAt(index);
    if (!this.checklist.length) {
      this.addChecklistItem();
    }
  }

  protected trackChecklistItem(index: number): number {
    return index;
  }

  private resetChecklist(): void {
    while (this.checklist.length) {
      this.checklist.removeAt(0);
    }
    this.addChecklistItem();
  }

  private createChecklistItemGroup(initial?: {
    title?: string;
    description?: string;
    completed?: boolean;
  }): FormGroup {
    return this.fb.group({
      title: this.fb.control(initial?.title ?? '', [
        Validators.maxLength(180),
      ]),
      description: this.fb.control(initial?.description ?? '', [
        Validators.maxLength(2000),
      ]),
      completed: this.fb.control(initial?.completed ?? false),
    });
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
