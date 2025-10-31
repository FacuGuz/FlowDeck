import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIf, AsyncPipe } from '@angular/common';
import {Router, RouterLink} from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ModalService } from '../../../services/modal.service';

@Component({
  selector: 'app-header',
  standalone: true,
    imports: [NgIf, AsyncPipe, RouterLink],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);
  protected readonly currentUser$ = this.authService.currentUser$;
  private readonly router = inject(Router);
  private readonly modalService = inject(ModalService);

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
}
