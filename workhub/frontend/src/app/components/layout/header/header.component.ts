import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styles: [
    `
      @keyframes typing {
        0% {
          width: 0%;
          visibility: hidden;
        }
        100% {
          width: 100%;
        }
      }

      @keyframes blink {
        50% {
          border-color: transparent;
        }
        100% {

          border-color: #F5E5E1;
        }
      }

      .animate-flowdeck {
        animation: typing 4s steps(10) infinite alternate, blink 0.7s infinite;

        display: inline-block;
        overflow: hidden;
        white-space: nowrap;
        border-right-width: 1px;
        border-right-color: #F5E5E1;
        width: 100%;
      }
    `,
  ],
})
export class HeaderComponent {}
