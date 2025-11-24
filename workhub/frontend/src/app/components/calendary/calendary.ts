import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TaskService } from '../../services/task.service';
import { Task } from '../../interfaces/task';

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
  private readonly destroyRef = inject(DestroyRef);

  viewDate: Date = new Date();
  weekDays: string[] = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  calendarGrid: CalendarDay[] = [];

  activeTask: Task | null = null;

  private tasksMap: Map<string, Task[]> = new Map();

  ngOnInit(): void {
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
          if (!user) return of([]);

          return this.authService.getUserTeams(user.id).pipe(
            switchMap((memberships) => {
              if (!memberships.length) return of([]);

              const requests = memberships.map(m =>
                this.taskService.list({
                  teamId: m.teamId,
                  assigneeId: user.id
                })
              );

              return forkJoin(requests).pipe(
                map(results => results.flat())
              );
            })
          );
        })
      )
      .subscribe({
        next: (tasks) => {
          this.organizeTasksByDate(tasks);
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
}
