import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, of, switchMap, Observable } from 'rxjs';
import { Task, TaskStatus, TaskChecklistItem } from '../../interfaces/task';
import { User } from '../../interfaces/user';
import { AuthService } from '../../services/auth.service';
import { TaskService } from '../../services/task.service';
import { TeamService } from '../../services/team.service';

type TaskView = Task & {
  teamName?: string;
  assigneeName?: string;
  assigneeEmail?: string;
};

@Component({
  selector: 'app-tasks',
  imports: [
    FormsModule
  ],
  templateUrl: './tasks.html',
  styleUrl: './tasks.css',
})
export class Tasks {
  private readonly taskService = inject(TaskService);
  private readonly authService = inject(AuthService);
  private readonly teamService = inject(TeamService);
  private readonly destroyRef = inject(DestroyRef);

  tareas: TaskView[] = [];
  protected readonly taskStatuses: TaskStatus[] = [
    'TODO',
    'IN_PROGRESS',
    'BLOCKED',
    'DONE',
  ];

  ngOnInit(): void {
    this.observeUserTasks();
  }

  private observeUserTasks(): void {
    this.authService.currentUser$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((user) => {
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
}
