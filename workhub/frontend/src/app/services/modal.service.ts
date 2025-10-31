import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ActiveModal = 'login' | 'register' | null;

@Injectable({ providedIn: 'root' })
export class ModalService {
  private readonly activeModalSubject = new BehaviorSubject<ActiveModal>(null);
  readonly activeModal$ = this.activeModalSubject.asObservable();

  open(modal: Exclude<ActiveModal, null>): void {
    this.activeModalSubject.next(modal);
  }

  close(): void {
    this.activeModalSubject.next(null);
  }
}
