import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="top-bar">
      <div class="logo-area">
        <span class="menu-toggle" (click)="toggleSidebar()">
          <span class="material-symbols-outlined">menu</span>
        </span>
        <span class="title"></span>
      </div>
      
      <div class="search-area">
        <div class="search-wrapper">
          <span class="material-symbols-outlined search-icon">search</span>
          <input 
            type="text" 
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearch()"
            placeholder="Search connections..." 
            class="search-input"
          />
        </div>
      </div>
      

      <div class="actions-area">
        
        <div class="auth-area" *ngIf="!isAuthenticated">
          <button class="btn-login" (click)="onLogin()">Login</button>
          <button class="btn-login" (click)="router.navigate(['/register'])">Sign up</button>
        </div>

        <div class="user-profile" *ngIf="isAuthenticated">
          <div class="avatar">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDyM4rVQ5m4tkzGiywNWcvKT02fuQKibDEeEZkkAGlM-684YxbYKlOdx9yLpBIBhJ56wLooCwphOvo-lDZIXHkh8Kf_a6ofe3Hxp8N9WTj5Tx1fxkxx_BE3o1EInA0X4hKjoVuQT9wGWtIy6xZ0Qul7uDBGssvKnMp3qD__KHn4JLDcsI_UtdFe6jKnNG9wn_AYS_y8CkS1g_xZl8EZQ7qIxt5zJFlvgjQ3coBd_vQN1dtmkC6o_PAUO2IUqmezz_FA5WOtXDvol9c" 
              alt="User Avatar"
            />
          </div>
          <span class="username">{{ username }}</span>
          <button class="btn-logout" (click)="onLogout()">Logout</button>
        </div>
      </div>
    </header>
  `,
  styles: [
    `
    .top-bar {
      position: sticky;
      top: 0;
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 24px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 40;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .menu-toggle {
      display: none;
      cursor: pointer;
    }
    .title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .search-area {
      flex: 1;
      display: flex;
      justify-content: center;
      max-width: 400px;
      margin: 0 24px;
    }
    .search-wrapper {
      position: relative;
      width: 100%;
    }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
      font-size: 18px;
    }
    .search-input {
      width: 100%;
      padding: 8px 12px 8px 40px;
      background: #f8fafc;
      border: none;
      border-radius: 9999px;
      font-size: 14px;
      transition: all 0.2s;
    }
    .search-input:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
    }
    .actions-area {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .icon-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #64748b;
      display: flex;
      align-items: center;
      transition: color 0.2s;
    }
    .icon-btn:hover {
      color: #0ea5e9;
    }
    .user-profile {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid #cbd5e1;
      overflow: hidden;
    }
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .username {
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }
    .auth-area {
      margin-right: 12px;
    }
    .btn-login, .btn-logout {
      background: transparent;
      border: 1px solid #0ea5e9;
      color: #0ea5e9;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-login:hover {
      background: #0ea5e9;
      color: white;
    }
    .btn-logout {
      border-color: #ef4444;
      color: #ef4444;
    }
    .btn-logout:hover {
      background: #ef4444;
      color: white;
    }
    @media (max-width: 768px) {
      .menu-toggle {
        display: block;
      }
      .search-area {
        margin: 0 12px;
      }
      .actions-area {
        gap: 8px;
      }
      .username {
        display: none;
      }
    }
  `
  ]
})
export class TopBarComponent {
  searchQuery: string = '';
  isAuthenticated = false;
  username: string = '';

  constructor(private authService: AuthService, public router: Router) {
    this.authService.isAuthenticated$.subscribe(v => {
      this.isAuthenticated = v;
      if (v) {
        this.username = this.authService.getUsername() || 'User';
      }
    });
  }
  
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar?.classList.toggle('open');
  }
  
  onSearch() {
    // Implement search functionality
    console.log('Searching for:', this.searchQuery);
  }

  onLogout() {
    this.authService.logout();
  }

  onLogin() {
    this.router.navigate(['/login']);
  }
}