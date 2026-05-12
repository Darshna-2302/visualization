import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="sidebar">
      <div class="logo-section">
        <h2 class="logo">visulization</h2>
        <p class="subtitle"></p>
      </div>
      
      <nav class="nav-menu">
   
        
  
        
        <a [routerLink]="['/query-builder']" routerLinkActive="active" class="nav-item">
          <span class="material-symbols-outlined">query_stats</span>
          <span>Query Builder</span>
        </a>
        
        <a [routerLink]="['/browse-data']" routerLinkActive="active" class="nav-item">
          <span class="material-symbols-outlined">table_view</span>
          <span>Browse Data</span>
        </a>
        
        <a [routerLink]="['/saved-questions']" routerLinkActive="active" class="nav-item">
          <span class="material-symbols-outlined">inventory_2</span>
          <span>Saved Questions</span>
        </a>
        
        <a [routerLink]="['/connections']" routerLinkActive="active" class="nav-item active-link">
          <span class="material-symbols-outlined active-icon">database</span>
          <span>Connections</span>
        </a>
      </nav>
      
      <div class="bottom-section">
        <button class="new-question-btn " (click)="navigateToQuery()">
          <span class="material-symbols-outlined">add</span>
          New Question
        </button>
        
        <div class="footer-links">
          <a  class="footer-link">
            <span class="material-symbols-outlined">settings</span>
            <span>Settings</span>
          </a>
          
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      width: 256px;
      height: 100vh;
      background: white;
      border-right: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      padding: 16px 0;
      z-index: 50;
    }
    .logo-section {
      padding: 0 24px;
      margin-bottom: 32px;
    }
    .logo {
      font-size: 20px;
      font-weight: 800;
      color: #0ea5e9;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .subtitle {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      font-weight: 700;
      margin: 4px 0 0;
    }
    .nav-menu {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0 12px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 12px;
      color: #475569;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .nav-item:hover {
      background: #f8fafc;
    }
    .nav-item.active {
      background: #f0f9ff;
      color: #0ea5e9;
      border-left: 4px solid #0ea5e9;
      margin-left: -4px;
    }
    .active-link {
      background: #f0f9ff;
      color: #0ea5e9;
      border-left: 4px solid #0ea5e9;
      margin-left: -4px;
    }
    .active-icon {
      font-variation-settings: 'FILL' 1;
    }
    .material-symbols-outlined {
      font-size: 20px;
    }
    .bottom-section {
      padding: 0 16px;
      margin-top: auto;
    }
    .new-question-btn {
      width: 100%;
      background: #0ea5e9;
      color: white;
      font-weight: 700;
      padding: 10px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: background 0.2s;
      margin-bottom: 24px;
    }
    .new-question-btn:hover {
      background: #0284c7;
    }
    .footer-links {
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
    .footer-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      color: #64748b;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .footer-link:hover {
      background: #f8fafc;
    }
    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
        transition: transform 0.3s;
      }
      .sidebar.open {
        transform: translateX(0);
      }
    }
  `]
})
export class SidebarComponent {
  constructor(private router: Router) {}
  
  navigateToQuery() {
    this.router.navigate(['/query-builder']);
  }
}