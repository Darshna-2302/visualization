import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopBarComponent } from './components/topbar/topbar.component';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopBarComponent],
  template: `
    <ng-container *ngIf="authService.isAuthenticated$ | async; else loginOnly">
      <div class="app-container">
        <app-sidebar></app-sidebar>
        <main class="main-content">
          <app-top-bar></app-top-bar>
          <div class="page-content">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>
    </ng-container>
    <ng-template #loginOnly>
      <div class="app-login-only">
        <router-outlet></router-outlet>
      </div>
    </ng-template>
  `,
  styles: [`
    .app-container {
      display: flex;
      min-height: 100vh;
    }
    .main-content {
      flex: 1;
      margin-left: 256px;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .page-content {
      flex: 1;
      padding: 32px;
      max-width: 1280px;
      margin: 0 auto;
      width: 100%;
    }
    .footer {
      text-align: center;
      padding: 32px 24px;
      color: #404750;
      font-size: 14px;
    }
    @media (max-width: 768px) {
      .main-content {
        margin-left: 0;
      }
    }
  `]
})
export class AppComponent {
  title = 'metabase-clone';

  constructor(public authService: AuthService) {}
}