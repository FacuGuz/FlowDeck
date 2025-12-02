import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/user';
import { ModalService } from '../../services/modal.service';
import { toFriendlyError } from '../../services/error.utils';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  private readonly authService = inject(AuthService);
  private readonly modalService = inject(ModalService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected currentUser: User | null = null;
  protected profileForm = this.fb.group({
    nickname: ['', [Validators.maxLength(60)]],
  });
  protected isSavingProfile = false;
  protected isUploadingAvatar = false;
  protected feedback: { type: 'success' | 'error'; text: string } | null = null;
  protected avatarPreview: string | null = null;
  protected pendingAvatarFile: File | null = null;

  constructor() {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.currentUser = user;
        this.profileForm.reset(
          {
            nickname: user?.nickname ?? '',
          },
          { emitEvent: false }
        );
        if (!this.pendingAvatarFile) {
          this.avatarPreview = user?.avatarUrl ?? null;
        }
      });
  }

  protected saveProfile(): void {
    if (!this.currentUser) {
      this.setFeedback('error', 'Debes iniciar sesión para actualizar tu perfil.');
      return;
    }
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.isSavingProfile = true;
    const nickname = this.profileForm.controls.nickname.value?.trim() ?? '';
    this.authService
      .updateUserProfile(this.currentUser.id, { nickname: nickname || null })
      .subscribe({
        next: () => {
          this.isSavingProfile = false;
          this.setFeedback('success', 'Apodo actualizado correctamente.');
          this.pendingAvatarFile = null;
        },
        error: (error) => {
          this.isSavingProfile = false;
          this.setFeedback('error', toFriendlyError(error).message);
        },
      });
  }

  protected onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files.length) {
      this.pendingAvatarFile = null;
      this.avatarPreview = this.currentUser?.avatarUrl ?? null;
      return;
    }

    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      this.setFeedback('error', 'La imagen debe pesar menos de 2 MB.');
      input.value = '';
      return;
    }

    this.pendingAvatarFile = file;
    const reader = new FileReader();
    reader.onload = () => (this.avatarPreview = reader.result as string);
    reader.readAsDataURL(file);
  }

  protected uploadAvatar(): void {
    if (!this.currentUser || !this.pendingAvatarFile) {
      return;
    }
    this.isUploadingAvatar = true;
    this.authService.uploadUserAvatar(this.currentUser.id, this.pendingAvatarFile).subscribe({
      next: (user) => {
        this.isUploadingAvatar = false;
        this.pendingAvatarFile = null;
        this.avatarPreview = user.avatarUrl ?? null;
        this.setFeedback('success', 'Avatar actualizado correctamente.');
      },
      error: (error) => {
        this.isUploadingAvatar = false;
        this.setFeedback('error', toFriendlyError(error).message);
      },
    });
  }

  protected clearAvatarSelection(): void {
    this.pendingAvatarFile = null;
    this.avatarPreview = this.currentUser?.avatarUrl ?? null;
  }

  protected openLogin(): void {
    this.modalService.open('login');
  }

  private setFeedback(type: 'success' | 'error', text: string): void {
    this.feedback = { type, text };
    if (type === 'success') {
      setTimeout(() => {
        if (this.feedback?.type === 'success') {
          this.feedback = null;
        }
      }, 4000);
    }
  }
}
