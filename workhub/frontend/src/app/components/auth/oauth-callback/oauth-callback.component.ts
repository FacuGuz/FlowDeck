import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../interfaces/user';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './oauth-callback.component.html',
})
export class OAuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  statusMessage = 'Procesando inicio de sesión...';
  errorMessage: string | null = null;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const userId = Number(params.get('userId'));
    const email = params.get('email') ?? '';
    const fullName = params.get('fullName') ?? '';
    const role = (params.get('role') ?? 'USER') as User['role'];
    const createdAt = params.get('createdAt') ?? new Date().toISOString();

    if (!userId || !email) {
      this.errorMessage = 'Faltan datos para completar el inicio de sesión.';
      this.statusMessage = 'No se pudo completar el inicio de sesión.';
      return;
    }

    const user: User = {
      id: userId,
      email,
      fullName: fullName || email,
      role,
      password: '',
      createdAt,
    };

    this.authService.completeOAuthLogin(user);
    this.statusMessage = 'Sesión iniciada con Google. Redirigiendo...';
    setTimeout(() => this.router.navigate(['/panel']), 500);
  }
}
