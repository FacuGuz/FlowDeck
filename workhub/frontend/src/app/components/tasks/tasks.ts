import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators
} from '@angular/forms';
import {
  BehaviorSubject,
  Observable,
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
  tap,
} from 'rxjs';
import { Task, TaskStatus, TaskChecklistItem, TaskCreateRequest, TaskCompletionAction } from '../../interfaces/task';
import { User, UserTeam } from '../../interfaces/user';
import { AuthService } from '../../services/auth.service';
import { TaskService } from '../../services/task.service';
import { TeamService } from '../../services/team.service';
import { ModalService } from '../../services/modal.service';
import { toFriendlyError } from '../../services/error.utils';
import { Team, TeamMember } from '../../interfaces/team';
import { TeamRole } from '../../enums/team-role';

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

type TaskView = Task & {
  teamName?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  assigneeAvatar?: string | null;
  membershipRole?: TeamRole | null;
};

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './tasks.html',
  styleUrl: './tasks.css',
})
export class Tasks implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly authService = inject(AuthService);
  private readonly teamService = inject(TeamService);
  private readonly modalService = inject(ModalService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  tareas: TaskView[] = [];
  protected readonly taskStatuses: TaskStatus[] = [
    'TODO',
    'IN_PROGRESS',
    'BLOCKED',
    'PENDING_APPROVAL',
    'DONE',
  ];

  protected readonly user$ = this.authService.currentUser$;
  private readonly refreshTeams$ = new BehaviorSubject<void>(undefined);
  private readonly refreshTasks$ = new BehaviorSubject<void>(undefined);

  private readonly selectedTeamId$ = new BehaviorSubject<number | null>(null);
  private readonly viewMode$ = new BehaviorSubject<'mine' | 'team'>('mine');

  private currentUser: User | null = null;
  private readonly completionLoading = new Set<number>();
  private readonly membershipRoleByTeam = new Map<number, TeamRole>();
  private readonly ownerTeamIds = new Set<number>();
  private readonly teamInfoById = new Map<number, Team>();

  protected activeTasks: TaskView[] = [];
  protected completedTasks: TaskView[] = [];
  protected showHistory = false;
  private readonly deletingTasks = new Set<number>();
  protected canCreateTasks = false;
  protected confirmDeleteId: number | null = null;

  protected activePanel: string | null = null;
  protected isProcessing = false;
  protected feedback: { type: 'success' | 'error'; text: string; } | undefined ;

  protected readonly memberships$: Observable<UserTeam[]> = combineLatest([
    this.user$,
    this.refreshTeams$,
  ]).pipe(
    switchMap(([user]) => {
      if (!user) {
        return of<UserTeam[]>([]);
      }
      return this.authService.getUserTeams(user.id);
    }),
    tap((memberships: UserTeam[]) => this.syncMembershipState(memberships)),
    shareReplay(1)
  );

  protected readonly teamOptions$: Observable<TeamOption[]> = this.memberships$.pipe(
    switchMap((memberships: UserTeam[]) => {
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
            if (error?.status === 404) {
              console.warn('[Tasks] Equipo no encontrado, se omitirá', membership.teamId);
              return of<TeamOption | null>(null);
            }
            return of<TeamOption | null>(null);
          })
        )
      );
      return forkJoin(requests).pipe(
        map((entries: Array<TeamOption | null>) =>
          entries
            .filter((entry): entry is TeamOption => entry !== null)
            .sort((a, b) => a.team.name.localeCompare(b.team.name))
        )
      );
    }),
    tap((options) => {
      this.teamInfoById.clear();
      options.forEach((option) => this.teamInfoById.set(option.team.id, option.team));
    }),
    shareReplay(1)
  );

  protected readonly ownerTeamOptions$: Observable<TeamOption[]> = this.teamOptions$.pipe(
    map((options: TeamOption[]) => options.filter((option) => option.membershipRole === 'OWNER')),
    shareReplay(1)
  );

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

  constructor() {
    this.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        console.debug('[Tasks] currentUser$ emission', user);
        this.currentUser = user;
      });

    this.createTaskForm.controls.teamId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        console.debug('[Tasks] teamId changed, clearing assignee');
        this.createTaskForm.controls.assigneeId.setValue(null);
      });

    this.resetChecklist();
  }

  ngOnInit(): void {
    this.observeUserTasks();
  }

  refresh(): void {
    this.refreshTeams();
    this.reloadTasks();
  }

  toggleTeamFilter(teamId: number): void {
    const current = this.selectedTeamId$.value;
    this.selectedTeamId$.next(current === teamId ? null : teamId);
  }

  isTeamSelected(teamId: number): boolean {
    return this.selectedTeamId$.value === teamId;
  }

  setViewMode(mode: 'mine' | 'team'): void {
    if (this.viewMode$.value !== mode) {
      this.viewMode$.next(mode);
    }
  }

  isViewMode(mode: 'mine' | 'team'): boolean {
    return this.viewMode$.value === mode;
  }

  private observeUserTasks(): void {
    combineLatest({
      user: this.authService.currentUser$,
      memberships: this.memberships$,
      selectedTeamId: this.selectedTeamId$,
      viewMode: this.viewMode$,
      refreshTick: this.refreshTasks$,
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(({ user, memberships, selectedTeamId, viewMode }): Observable<TaskView[]> => {
          if (!user) {
            this.tareas = [];
            return of<TaskView[]>([]);
          }

          if (!memberships.length) {
            return of<TaskView[]>([]);
          }

          const teamsToUse = selectedTeamId
            ? memberships.filter((m) => m.teamId === selectedTeamId)
            : memberships;

          if (!teamsToUse.length) {
            return of<TaskView[]>([]);
          }

          const requests: Observable<Task[]>[] = teamsToUse.map((membership: UserTeam) => {
            const params: { teamId: number; assigneeId?: number } = { teamId: membership.teamId };
            if (viewMode === 'mine') {
              params.assigneeId = user.id;
            }
            return this.taskService.list(params);
          });

          return forkJoin(requests).pipe(
            map((responses: Task[][]) => responses.flat()),
            switchMap((tasks) => this.enrichTasks(tasks, user))
          );
        })
      )
      .subscribe({
        next: (tasks) => {
          this.tareas = tasks;
          this.splitTasks(tasks);
        },
        error: (error) => {
          console.error('Error loading tasks', error);
          const empty: TaskView[] = [];
          this.tareas = empty;
          this.splitTasks(empty);
        },
      });
  }

  private enrichTasks(tasks: Task[], currentUser: User | null): Observable<TaskView[]> {
    if (!tasks.length) {
      return of<TaskView[]>([]);
    }

    const assigneeIds = Array.from(
      new Set(
        tasks
          .map((task) => task.assigneeId)
          .filter((id): id is number => id != null)
      )
    );

    const assigneeRequests = assigneeIds
      .filter((assigneeId) => !(currentUser && assigneeId === currentUser.id))
      .map((assigneeId) =>
        this.authService
          .getUser(assigneeId)
          .pipe(map((user) => [user.id, { fullName: this.getUserDisplayName(user), email: user.email, avatarUrl: user.avatarUrl ?? null }] as [number, { fullName: string; email: string; avatarUrl: string | null }]))
      );

    const assigneeEntries$ = assigneeRequests.length
      ? forkJoin(assigneeRequests)
      : of([] as Array<[number, { fullName: string; email: string; avatarUrl: string | null }]>);

    return assigneeEntries$.pipe(
      map((assigneeEntries) => {
        const assigneeMap = new Map<number, { fullName: string; email: string; avatarUrl: string | null }>(assigneeEntries);

        if (currentUser) {
          assigneeMap.set(currentUser.id, { fullName: this.getUserDisplayName(currentUser), email: currentUser.email, avatarUrl: currentUser.avatarUrl ?? null });
        }

        const teamMap = new Map<number, string>();
        this.teamInfoById.forEach((team, id) => {
          teamMap.set(id, team.name);
        });

        return tasks.map((task) => ({
          ...task,
          teamName: teamMap.get(task.teamId),
          assigneeName: task.assigneeId != null ? assigneeMap.get(task.assigneeId)?.fullName : undefined,
          assigneeEmail: task.assigneeId != null ? assigneeMap.get(task.assigneeId)?.email : undefined,
          assigneeAvatar: task.assigneeId != null ? assigneeMap.get(task.assigneeId)?.avatarUrl ?? null : null,
          membershipRole: this.membershipRoleByTeam.get(task.teamId) ?? null,
        }));
      })
    );
  }

  protected onStatusChange(task: TaskView, rawStatus: string): void {
    const newStatus = rawStatus as TaskStatus;
    if (task.status === newStatus) {
      return;
    }

     // El asignado no puede modificar el estado si ya fue completada (salvo que sea owner).
    if (task.status === 'DONE' && this.isTaskAssignee(task) && !this.isOwnerOfTask(task)) {
      this.setFeedback('error', 'No puedes modificar el estado una vez que la tarea fue completada. Contacta al owner del equipo.');
      return;
    }

    const previousStatus = task.status;
    task.status = newStatus;

    this.taskService.update(task.id, { status: newStatus }).subscribe({
      error: (error) => {
        console.error('Failed to update task status', error);
        task.status = previousStatus;
      },
    });
  }

  protected onChecklistToggle(task: TaskView, itemIndex: number): void {
    const target = task.checklist[itemIndex];
    if (!target) {
      return;
    }

    const previousCompleted = target.completed;
    const updatedChecklist: TaskChecklistItem[] = task.checklist.map((item, index) =>
      index === itemIndex ? { ...item, completed: !item.completed } : item
    );
    task.checklist = updatedChecklist;

    this.taskService
      .update(task.id, {
        checklist: updatedChecklist.map((item, index) => ({
          title: item.title,
          description: item.description,
          completed: item.completed,
          position: index,
          archived: item.archived,
        })),
      })
      .subscribe({
        error: (error) => {
          console.error('Failed to update checklist item', error);
          task.checklist = task.checklist.map((item, index) =>
            index === itemIndex ? { ...item, completed: previousCompleted } : item
          );
        },
      });
  }

  protected formatDueDate(dueOn: string | null): string {
    if (!dueOn) {
      return 'Sin fecha';
    }

    const [datePart] = dueOn.split('T');
    if (!datePart) {
      return 'Sin fecha';
    }

    const [year, month, day] = datePart.split('-');
    if (!year || !month || !day) {
      return 'Sin fecha';
    }

    return `${day}/${month}/${year}`;
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
        return 'Pendiente de aprobacion';
      case 'DONE':
        return 'Completada';
      default:
        return status;
    }
  }

  // --- NUEVAS FUNCIONES DE ESTILO VISUAL ---

  // Obtiene el color del borde izquierdo de la tarjeta
  protected getTaskBorderColor(status: string): string {
    switch (status) {
      case 'TODO': return 'border-l-slate-300'; // Gris
      case 'IN_PROGRESS': return 'border-l-amber-400'; // Amarillo
      case 'BLOCKED': return 'border-l-rose-500'; // Rojo
      case 'PENDING_APPROVAL': return 'border-l-amber-600'; // Pendiente de aprobacion
      case 'DONE': return 'border-l-emerald-500'; // Verde
      default: return 'border-l-slate-200';
    }
  }

  // Calcula si la fecha está vencida para colorearla
  protected getDueDateClass(dueOn: string | null): string {
    if (!dueOn) return 'text-slate-500';

    const due = new Date(dueOn);
    const today = new Date();
    // Reseteamos horas para comparar solo fechas
    today.setHours(0, 0, 0, 0);

    if (due < today) {
      return 'text-rose-600 font-bold'; // Vencida
    }
    if (due.getTime() === today.getTime()) {
      return 'text-amber-600 font-bold'; // Vence hoy
    }
    return 'text-slate-600'; // Futura
  }

  // Extrae las iniciales del nombre
  protected getInitials(name: string | undefined): string {
    if (!name) return '';
    return name
      .split(' ') // Divide por espacios
      .map(n => n[0]) // Toma la primera letra de cada palabra
      .slice(0, 2) // Solo toma las 2 primeras iniciales
      .join('')
      .toUpperCase();
  }

  openPanel(panel: string): void {
    console.debug('[Tasks] openPanel requested', panel, 'user', this.currentUser);
    if (!this.ensureAuthenticated()) {
      return;
    }

    if (panel === 'task' && !this.canCreateTasks) {
      this.setFeedback('error', 'Solo el owner del equipo puede crear tareas.');
      return;
    }

    this.activePanel = panel;
    this.isProcessing = false;

    this.createTaskForm.reset({
      teamId: null,
      title: '',
      description: '',
      status: 'TODO',
      assigneeId: null,
      dueOn: null,
    });
    this.resetChecklist();
  }

  closePanel(): void {
    this.activePanel = null;
    this.isProcessing = false;
  }

  openLogin(): void {
    this.modalService.open('login');
  }

  async submitCreateTask(): Promise<void> {
    if (this.createTaskForm.invalid) {
      this.createTaskForm.markAllAsTouched();
      this.setFeedback('error', 'Por favor revisa los campos requeridos.');
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

      if (!this.isOwnerTeam(teamId)) {
        this.setFeedback('error', 'Solo el owner del equipo puede crear tareas.');
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
      this.reloadTasks();
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

  private reloadTasks(): void {
    this.refreshTasks$.next(undefined);
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

  protected showCompletionButton(task: TaskView): boolean {
    if (!this.currentUser) {
      return false;
    }
    if (task.status === 'DONE' || task.status === 'PENDING_APPROVAL') {
      return false;
    }
    return this.isOwnerOfTask(task) || this.isTaskAssignee(task);
  }

  protected showOwnerApprovalActions(task: TaskView): boolean {
    return this.isAwaitingApproval(task) && this.isOwnerOfTask(task);
  }

  protected showWaitingApprovalMessage(task: TaskView): boolean {
    return this.isAwaitingApproval(task) && this.isTaskAssignee(task);
  }

  protected shouldDisableStatusSelect(task: TaskView): boolean {
    return task.status === 'DONE' && this.isTaskAssignee(task) && !this.isOwnerOfTask(task);
  }

  protected isAwaitingApproval(task: TaskView): boolean {
    return task.status === 'PENDING_APPROVAL';
  }

  protected isCompletionLoading(taskId: number): boolean {
    return this.completionLoading.has(taskId);
  }

  protected markTaskCompleted(task: TaskView): void {
    if (!this.showCompletionButton(task)) {
      return;
    }
    const action: TaskCompletionAction = this.isOwnerOfTask(task) ? 'APPROVE' : 'REQUEST';
    this.executeCompletionAction(task, action);
  }

  protected approveTaskCompletion(task: TaskView): void {
    if (!this.showOwnerApprovalActions(task)) {
      return;
    }
    this.executeCompletionAction(task, 'APPROVE');
  }

  protected rejectTaskCompletion(task: TaskView): void {
    if (!this.showOwnerApprovalActions(task)) {
      return;
    }
    this.executeCompletionAction(task, 'REJECT');
  }

  private executeCompletionAction(task: TaskView, action: TaskCompletionAction): void {
    if (!this.ensureAuthenticated() || !this.currentUser) {
      return;
    }

    if (action === 'REQUEST' && !this.isTaskAssignee(task)) {
      this.setFeedback('error', 'Solo el asignado puede solicitar la aprobacion.');
      return;
    }
    if ((action === 'APPROVE' || action === 'REJECT') && !this.isOwnerOfTask(task)) {
      this.setFeedback('error', 'Solo el owner del equipo puede gestionar aprobaciones.');
      return;
    }

    this.setCompletionLoading(task.id, true);
    this.taskService.complete(task.id, { userId: this.currentUser.id, action }).subscribe({
      next: () => {
        switch (action) {
          case 'REQUEST':
            this.setFeedback('success', 'Esperando aprobacion del lider.');
            break;
          case 'APPROVE':
            this.setFeedback('success', 'Tarea marcada como completada.');
            break;
          case 'REJECT':
            this.setFeedback('success', 'La tarea volvio a estado pendiente.');
            break;
        }
        this.reloadTasks();
      },
      error: (error) => {
        this.handleError(error);
        this.setCompletionLoading(task.id, false);
      },
      complete: () => this.setCompletionLoading(task.id, false),
    });
  }

  private isOwnerOfTask(task: TaskView): boolean {
    return this.membershipRoleByTeam.get(task.teamId) === 'OWNER';
  }

  protected canDeleteTask(task: TaskView): boolean {
    if (!this.currentUser) return false;
    return this.isOwnerOfTask(task) || task.createdBy === this.currentUser.id;
  }

  protected isDeleting(taskId: number): boolean {
    return this.deletingTasks.has(taskId);
  }

  protected promptDelete(task: TaskView): void {
    if (!this.canDeleteTask(task)) {
      this.setFeedback('error', 'No tienes permiso para eliminar esta tarea.');
      return;
    }
    this.confirmDeleteId = task.id;
  }

  protected cancelDelete(): void {
    this.confirmDeleteId = null;
  }

  protected deleteTask(task: TaskView): void {
    if (!this.currentUser) {
      this.openLogin();
      return;
    }
    if (!this.canDeleteTask(task)) {
      this.setFeedback('error', 'No tienes permiso para eliminar esta tarea.');
      return;
    }
    this.confirmDeleteId = null;
    this.deletingTasks.add(task.id);
    this.taskService.delete(task.id, this.currentUser.id).subscribe({
      next: () => {
        this.setFeedback('success', 'Tarea eliminada.');
        this.reloadTasks();
      },
      error: (error) => {
        this.handleError(error);
        this.deletingTasks.delete(task.id);
      },
      complete: () => this.deletingTasks.delete(task.id),
    });
  }

  private isTaskAssignee(task: TaskView): boolean {
    if (!this.currentUser) {
      return false;
    }
    return task.assigneeId === this.currentUser.id;
  }

  private setCompletionLoading(taskId: number, loading: boolean): void {
    if (loading) {
      this.completionLoading.add(taskId);
    } else {
      this.completionLoading.delete(taskId);
    }
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

  private getUserDisplayName(user: User): string {
    return user.nickname && user.nickname.trim().length > 0 ? user.nickname.trim() : user.fullName;
  }

  private syncMembershipState(memberships: UserTeam[]): void {
    this.membershipRoleByTeam.clear();
    this.ownerTeamIds.clear();
    memberships.forEach((membership) => {
      this.membershipRoleByTeam.set(membership.teamId, membership.role);
      if (membership.role === 'OWNER') {
        this.ownerTeamIds.add(membership.teamId);
      }
    });
    this.canCreateTasks = this.ownerTeamIds.size > 0;
  }

  private isOwnerTeam(teamId: number | null): boolean {
    if (teamId == null) {
      return false;
    }
    return this.ownerTeamIds.has(teamId);
  }

  private splitTasks(tasks: TaskView[]): void {
    this.activeTasks = tasks.filter((t) => t.status !== 'DONE');
    this.completedTasks = tasks
      .filter((t) => t.status === 'DONE')
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }

  protected getCompletionDate(task: TaskView): string {
    const date = task.updatedAt || task.createdAt;
    if (!date) return 'Sin fecha';
    const [d] = date.split('T');
    return d ?? 'Sin fecha';
  }
}
