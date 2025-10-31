import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { toFriendlyError } from '../../../services/error.utils';
import { ModalService } from '../../../services/modal.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgFor],
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly modalService = inject(ModalService);

  readonly roles = [
    { value: 'OWNER', label: 'Propietario' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'MEMBER', label: 'Miembro' },
  ];

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    role: ['MEMBER', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  isSubmitting = false;
  errorMessage: string | null = null;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;

    this.authService.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.modalService.close();
        void this.router.navigate(['/equipos']);
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

  openLogin(): void {
    this.modalService.open('login');
  }
}
