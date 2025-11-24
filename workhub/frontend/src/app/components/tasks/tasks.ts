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
  forkJoin,
  map,
  of,
  switchMap,
  Observable,
  firstValueFrom,
  startWith,
  distinctUntilChanged,
  catchError,
  combineLatest,
  BehaviorSubject, shareReplay
} from 'rxjs';
import { Task, TaskStatus, TaskChecklistItem, TaskCreateRequest } from '../../interfaces/task';
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
    'DONE',
  ];

  protected readonly user$ = this.authService.currentUser$;
  private readonly refreshTeams$ = new BehaviorSubject<void>(undefined);

  private readonly selectedTeamId$ = new BehaviorSubject<number | null>(null);

  private currentUser: User | null = null;

  protected activePanel: string | null = null;
  protected isProcessing = false;
  protected feedback: { type: 'success' | 'error'; text: string; } | undefined ;

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

  toggleTeamFilter(teamId: number): void {
    const current = this.selectedTeamId$.value;
    this.selectedTeamId$.next(current === teamId ? null : teamId);
  }

  isTeamSelected(teamId: number): boolean {
    return this.selectedTeamId$.value === teamId;
  }

  private observeUserTasks(): void {
    combineLatest([
      this.authService.currentUser$,
      this.selectedTeamId$
    ])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(([user, selectedTeamId]) => {
          if (!user) {
            this.tareas = [];
            return of<TaskView[]>([]);
          }

          return this.authService.getUserTeams(user.id).pipe(
            switchMap((memberships) => {
              if (!memberships.length) {
                return of<TaskView[]>([]);
              }

              const requests = memberships.map((membership) =>
                this.taskService.list({
                  teamId: membership.teamId,
                  assigneeId: user.id,
                })
              );

              return forkJoin(requests).pipe(
                map((responses) => responses.flat()),
                map((tasks) => {
                  if (selectedTeamId) {
                    return tasks.filter(t => t.teamId === selectedTeamId);
                  }
                  return tasks;
                }),
                switchMap((tasks) => this.enrichTasks(tasks, user))
              );
            })
          );
        })
      )
      .subscribe({
        next: (tasks) => {
          this.tareas = tasks;
        },
        error: (error) => {
          console.error('Error loading tasks', error);
          this.tareas = [];
        },
      });
  }

  private enrichTasks(tasks: Task[], currentUser: User | null): Observable<TaskView[]> {
    if (!tasks.length) {
      return of<TaskView[]>([]);
    }

    const teamIds = Array.from(new Set(tasks.map((task) => task.teamId)));
    const teamRequests = teamIds.map((teamId) =>
      this.teamService.get(teamId).pipe(map((team) => [teamId, team.name] as [number, string]))
    );

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
          .pipe(map((user) => [user.id, { fullName: user.fullName, email: user.email }] as [number, { fullName: string; email: string }]))
      );

    const teamEntries$ = teamRequests.length ? forkJoin(teamRequests) : of([] as Array<[number, string]>);
    const assigneeEntries$ = assigneeRequests.length
      ? forkJoin(assigneeRequests)
      : of([] as Array<[number, { fullName: string; email: string }]>);

    return forkJoin({ teamEntries: teamEntries$, assigneeEntries: assigneeEntries$ }).pipe(
      map(({ teamEntries, assigneeEntries }) => {
        const teamMap = new Map<number, string>(teamEntries);
        const assigneeMap = new Map<number, { fullName: string; email: string }>(assigneeEntries);

        if (currentUser) {
          assigneeMap.set(currentUser.id, { fullName: currentUser.fullName, email: currentUser.email });
        }

        return tasks.map((task) => ({
          ...task,
          teamName: teamMap.get(task.teamId),
          assigneeName: task.assigneeId != null ? assigneeMap.get(task.assigneeId)?.fullName : undefined,
          assigneeEmail: task.assigneeId != null ? assigneeMap.get(task.assigneeId)?.email : undefined,
        }));
      })
    );
  }

  protected onStatusChange(task: TaskView, rawStatus: string): void {
    const newStatus = rawStatus as TaskStatus;
    if (task.status === newStatus) {
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
      case 'DONE':
        return 'Completada';
      default:
        return status;
    }
  }

  openPanel(panel: string): void {
    console.debug('[Tasks] openPanel requested', panel, 'user', this.currentUser);
    if (!this.ensureAuthenticated()) {
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
      this.observeUserTasks();
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
}
