import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  private readonly modalService = inject(ModalService);

  openRegister(): void {
    this.modalService.open('register');
  }

  openLogin(): void {
    this.modalService.open('login');
  }
}

