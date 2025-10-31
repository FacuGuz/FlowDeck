import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { toFriendlyError } from '../../../services/error.utils';
import { ModalService } from '../../../services/modal.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly modalService = inject(ModalService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  isSubmitting = false;
  errorMessage: string | null = null;

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;

    const { email, password } = this.form.getRawValue();
    this.authService
      .login(email, password)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.modalService.close();
          void this.router.navigate(['/panel']);
        },
        error: (error: unknown) => {
          this.isSubmitting = false;
          this.errorMessage = toFriendlyError(error).message;
        },
      });
  }

  close(): void {
    this.modalService.close();
  }

  openRegister(): void {
    this.modalService.open('register');
  }
}
