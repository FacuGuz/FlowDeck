import { Routes } from '@angular/router';
import { ControlPanel } from './components/control-panel/control-panel';
import { Teams } from './components/teams/teams';
import { Tasks } from './components/tasks/tasks';
import { Calendary } from './components/calendary/calendary';
import { Settings } from './components/settings/settings';
import { Landing } from './components/landing/landing';

export const routes: Routes = [
  {
    path: '', redirectTo: 'inicio', pathMatch: 'full'
  },
  {
    path: 'inicio', component: Landing
  },
  {
    path: 'panel', component: ControlPanel
  },
  {
    path: 'equipos', component: Teams
  },
  {
    path: 'tareas', component: Tasks
  },
  {
    path: 'calendario', component: Calendary
  },
  {
    path: 'ajustes', component: Settings
  }
];
