import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ModalService } from '../../services/modal.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/user';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  private readonly modalService = inject(ModalService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private currentUser: User | null = null;

  constructor() {
    this.authService.currentUser$.subscribe((user) => (this.currentUser = user));
  }

  openRegister(): void {
    this.modalService.open('register');
  }

  openLogin(): void {
    this.modalService.open('login');
  }

  async goToBoards(): Promise<void> {
    const user = await firstValueFrom(this.authService.currentUser$);
    if (!user) {
      this.openRegister();
      return;
    }
    this.router.navigateByUrl('/panel');
  }

  async goToTeams(): Promise<void> {
    const user = await firstValueFrom(this.authService.currentUser$);
    if (!user) {
      this.openLogin();
      return;
    }
    this.router.navigateByUrl('/equipos');
  }
}
