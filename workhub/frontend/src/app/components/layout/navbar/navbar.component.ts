import { Component } from '@angular/core';

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.component.html'
})
export class NavbarComponent {
  readonly menuItems = ['Panel', 'Equipos', 'Tareas', 'Calendario', 'Ajustes'];
}
