import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { AsyncPipe, NgForOf, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, interval, map, of, startWith, switchMap, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../services/auth.service';
import { ModalService } from '../../../services/modal.service';
import { NotificationService } from '../../../services/notification.service';
import { Notification } from '../../../interfaces/notification';
import { User } from '../../../interfaces/user';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NgIf, AsyncPipe, RouterLink, NgForOf],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);
  protected readonly currentUser$ = this.authService.currentUser$;
  private readonly router = inject(Router);
  private readonly modalService = inject(ModalService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly notificationsSubject = new BehaviorSubject<Notification[]>([]);
  protected readonly notifications$ = this.notificationsSubject.asObservable();
  protected readonly unreadCount$ = this.notifications$.pipe(
    map((notifications) => notifications.filter((notification) => !notification.read).length)
  );
  private readonly refreshTicker$ = interval(15000).pipe(startWith(0));

  protected isPanelOpen = false;

  constructor() {
    combineLatest([this.currentUser$, this.refreshTicker$])
      .pipe(
        switchMap(([user]) => {
          if (!user) {
            this.notificationsSubject.next([]);
            this.isPanelOpen = false;
            return of([]);
          }
          return this.notificationService.list({ userId: user.id });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (notifications) => this.notificationsSubject.next(notifications),
      });
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/inicio']);
  }

  openLogin(): void {
    this.modalService.open('login');
  }

  openRegister(): void {
    this.modalService.open('register');
  }

  toggleNotifications(): void {
    this.isPanelOpen = !this.isPanelOpen;
  }

  markAsRead(notification: Notification, event: MouseEvent): void {
    event.stopPropagation();
    if (notification.read) {
      return;
    }

    this.notificationService
      .markAsRead(notification.id)
      .pipe(take(1))
      .subscribe((updated) => {
        this.notificationsSubject.next(
          this.notificationsSubject.value.map((item) =>
            item.id === updated.id ? updated : item
          )
        );
      });
  }

  protected getDisplayName(user: User): string {
    return user.nickname && user.nickname.trim().length > 0 ? user.nickname.trim() : user.fullName;
  }

  protected getInitials(user: User): string {
    const source = this.getDisplayName(user);
    return source
            .split(' ')
            .filter(Boolean)
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || user.fullName.slice(0, 1).toUpperCase();
  }
}
