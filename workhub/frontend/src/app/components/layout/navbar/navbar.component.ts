import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../services/auth.service';
import { ModalService } from '../../../services/modal.service';
import { User } from '../../../interfaces/user';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink
  ],
  templateUrl: './navbar.component.html'
})
export class NavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly modalService = inject(ModalService);
  private readonly router = inject(Router);

  currentUser: User | null = null;

  constructor() {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed())
      .subscribe((user) => (this.currentUser = user));
  }

  private readonly protectedRoutes = new Set(['/panel', '/equipos', '/tareas', '/calendario']);

  onNav(route: string, event: Event): void {
    if (!this.currentUser && this.protectedRoutes.has(route)) {
      event.preventDefault();
      this.modalService.open('login');
      return;
    }
    this.router.navigateByUrl(route);
  }
}
