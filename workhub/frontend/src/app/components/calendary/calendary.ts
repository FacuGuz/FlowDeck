import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map, of, switchMap, tap, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TaskService } from '../../services/task.service';
import { TeamService } from '../../services/team.service';
import { CalendarService } from '../../services/calendar.service';
import { Task } from '../../interfaces/task';
import { UserTeam, User } from '../../interfaces/user';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './calendary.html',
  styleUrl: './calendary.css'
})
export class Calendary implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly taskService = inject(TaskService);
  private readonly teamService = inject(TeamService);
  private readonly calendarService = inject(CalendarService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  viewDate: Date = new Date();
  weekDays: string[] = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  calendarGrid: CalendarDay[] = [];

  activeTask: Task | null = null;

  private tasksMap: Map<string, Task[]> = new Map();
  private teamNames: Map<number, string> = new Map();
  private currentUser: User | null = null;
  private readonly calendarIntegrationEnabled = false;
  calendarLinked = false;
  toastVisible = false;
  toastLink = 'https://calendar.google.com/calendar';

  ngOnInit(): void {
    // Siempre arrancamos mostrando el mes actual.
    this.viewDate = new Date();
    this.generateCalendar();

    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => (this.currentUser = user));

    this.detectCalendarLink();
    this.loadUserTasks();
  }

  openTaskDetails(task: Task, event: Event): void {
    event.stopPropagation();
    this.activeTask = task;
  }

  closeTaskDetails(): void {
    this.activeTask = null;
  }

  private loadUserTasks(): void {
    this.authService.currentUser$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((user) => {
          if (!user) return of({ tasks: [], memberships: [] as UserTeam[] });

          return this.authService.getUserTeams(user.id).pipe(
            tap((memberships) => this.loadTeamNames(memberships)),
            switchMap((memberships) => {
              if (!memberships.length) return of({ tasks: [], memberships });

              const requests = memberships.map(m =>
                this.taskService.list({
                  teamId: m.teamId,
                  assigneeId: user.id
                })
              );

              return forkJoin(requests).pipe(
                map(results => ({ tasks: results.flat(), memberships }))
              );
            })
          );
        })
      )
      .subscribe({
        next: (payload) => {
          this.organizeTasksByDate(payload.tasks);
          this.generateCalendar();
        },
        error: (err) => console.error(err)
      });
  }

  private organizeTasksByDate(tasks: Task[]): void {
    this.tasksMap.clear();
    tasks.forEach(task => {
      if (!task.dueOn) return;

      const datePart = task.dueOn.toString().split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      const dateKey = new Date(year, month - 1, day).toDateString();

      const current = this.tasksMap.get(dateKey) || [];
      current.push(task);
      this.tasksMap.set(dateKey, current);
    });
  }

  generateCalendar(): void {
    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const grid: CalendarDay[] = [];
    const today = new Date().toDateString();

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      grid.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        tasks: this.getTasksForDate(date)
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      grid.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today,
        tasks: this.getTasksForDate(date)
      });
    }

    const remainingCells = 42 - grid.length;
    for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(year, month + 1, i);
      grid.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        tasks: this.getTasksForDate(date)
      });
    }

    this.calendarGrid = grid;
  }

  private getTasksForDate(date: Date): Task[] {
    return this.tasksMap.get(date.toDateString()) || [];
  }

  changeMonth(offset: number): void {
    this.viewDate = new Date(
      this.viewDate.getFullYear(),
      this.viewDate.getMonth() + offset,
      1
    );
    this.generateCalendar();
  }

  async connectCalendar(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.calendarIntegrationEnabled) {
      return;
    }
    if (this.calendarLinked) return;
    const user = this.currentUser ?? await firstValueFrom(this.authService.currentUser$);
    if (!user) {
      this.router.navigateByUrl('/');
      return;
    }
    try {
      const url = await firstValueFrom(this.calendarService.startGoogleCalendar(user.id));
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error(err);
    }
  }

  async syncTaskToCalendar(task: Task, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.calendarIntegrationEnabled) return;
    if (!task.dueOn) return;
    const user = this.currentUser ?? await firstValueFrom(this.authService.currentUser$);
    if (!user) {
      this.router.navigateByUrl('/');
      return;
    }

    const date = task.dueOn.split('T')[0];
    const teamName = this.teamNames.get(task.teamId) ?? `Equipo ${task.teamId}`;

    this.calendarService
      .syncTask({
        userId: user.id,
        teamName,
        taskName: task.title,
        date
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.showToast(),
        error: (err) => console.error(err)
      });
  }

  private loadTeamNames(memberships: UserTeam[]): void {
    const missing = memberships
      .map((m) => m.teamId)
      .filter((id) => !this.teamNames.has(id));

    missing.forEach((teamId) => {
      this.teamService
        .get(teamId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (team) => this.teamNames.set(teamId, team.name),
          error: (err) => console.error(err)
        });
    });
  }

  private detectCalendarLink(): void {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    if (params.get('calendarLinked') === 'true') {
      this.calendarLinked = true;
      window.localStorage.setItem('flowdeck.calendarLinked', 'true');
    } else {
      this.calendarLinked = window.localStorage.getItem('flowdeck.calendarLinked') === 'true';
    }
  }

  private showToast(): void {
    this.toastVisible = true;
    setTimeout(() => (this.toastVisible = false), 7000);
  }
}
