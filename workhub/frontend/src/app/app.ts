import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { HeaderComponent } from './components/layout/header/header.component';
import { NavbarComponent } from './components/layout/navbar/navbar.component';
import { ContentComponent } from './components/layout/content/content.component';
import { FooterComponent } from './components/layout/footer/footer.component';
import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { ModalService } from './services/modal.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HeaderComponent,
    NavbarComponent,
    FooterComponent,
    ContentComponent,
    NgIf,
    AsyncPipe,
    LoginComponent,
    RegisterComponent
  ],
  templateUrl: './app.html'
})
export class App {
  private readonly modalService = inject(ModalService);
  protected readonly activeModal$ = this.modalService.activeModal$;
}
