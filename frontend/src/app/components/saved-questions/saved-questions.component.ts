import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SavedQuestion, SavedQuestionsService } from '../../services/saved-Question.service';
import { ToastService } from '../../services/toast.service';
import { connect, Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-saved-questions',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="saved-container">
      <div class="page-header">
        <h1 class="page-title">Saved Questions</h1>
        <p class="page-description">Your saved queries and analyses</p>
      </div>
      
      <!-- Search and Filter Bar -->
      <div class="filters-bar">
        <div class="search-box">
          <span class="material-symbols-outlined">search</span>
          <input 
            type="text" 
            [(ngModel)]="searchTerm"
            (ngModelChange)="applyFilters()"
            placeholder="Search questions by name or table..." 
            class="search-input"
          />
        </div>
        
        <div class="filter-group">
          <label>Type:</label>
          <select [(ngModel)]="selectedType" (ngModelChange)="applyFilters()" class="filter-select">
            <option value="all">All Types</option>
            <option value="visual">Visual Builder</option>
            <option value="sql">SQL Query</option>
          </select>
        </div>
      </div>
      
      <div class="questions-card">
        <div class="card-header">
          <h3>All Questions ({{filteredQuestions.length}})</h3>
          <a class="btn-new" [routerLink]="['/query-builder']">
            <span class="material-symbols-outlined">add</span>
            New Question
          </a>
        </div>
        
        <!-- Loading State -->
        <div *ngIf="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading saved questions...</p>
        </div>
        
        <!-- Empty State -->
        <div *ngIf="!loading && filteredQuestions.length === 0" class="empty-state">
          <span class="material-symbols-outlined">inbox</span>
          <p>No saved questions yet</p>
          <p class="empty-subtitle">Create your first question in the Query Builder</p>
        </div>
        
        <!-- Questions List -->
        <div *ngIf="!loading && filteredQuestions.length > 0" class="questions-list">
          <div *ngFor="let question of filteredQuestions" class="question-item">
            <div class="question-info">
              <div class="question-header">
                <span class="question-icon" [class]="question.type">
                  <span class="material-symbols-outlined">{{getQuestionTypeIcon(question.type)}}</span>
                </span>
                <div class="question-details">
                  <h4>{{question.name}}</h4>
                  <div class="question-meta">
                    <span class="question-table">
                      <span class="material-symbols-outlined">table_view</span>
                      {{question.table}}
                    </span>
                    <span class="question-date">
                      <span class="material-symbols-outlined">schedule</span>
                      {{formatDate(question.createdAt)}}
                    </span>
                    <span class="question-type-badge" [class]="question.type">
                      {{getQuestionTypeLabel(question.type)}}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div class="question-actions">
              <button (click)="loadQuestion(question)" class="btn-view" title="View question">
                <span class="material-symbols-outlined">visibility</span>
                View
              </button>
              <button (click)="deleteQuestion(question.id, $event)" class="btn-delete" title="Delete question">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .saved-container {
      width: 100%;
    }
    .page-header {
      margin-bottom: 32px;
    }
    .page-title {
      font-size: 32px;
      font-weight: 700;
      color: #0b1c30;
      margin: 0 0 8px;
    }
    .page-description {
      font-size: 14px;
      color: #404750;
      margin: 0;
    }
    
    /* Filters Bar */
    .filters-bar {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    
    .search-box {
      flex: 1;
      display: flex;
      align-items: center;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      gap: 8px;
    }
    
    .search-box .material-symbols-outlined {
      color: #94a3b8;
      font-size: 20px;
    }
    
    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 14px;
    }
    
    .search-input:focus {
      outline: none;
    }
    
    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .filter-group label {
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
    }
    
    .filter-select {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      background: white;
      cursor: pointer;
    }
    
    .questions-card {
      background: white;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }
    
    .card-header {
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
    }
    
    .card-header h3 {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
      color: #0f172a;
    }
    
    .btn-new {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #0ea5e9;
      color: white;
      text-decoration: none;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s;
    }
    
    .btn-new:hover {
      background: #0284c7;
    }
    
    .btn-new .material-symbols-outlined {
      font-size: 18px;
    }
    
    /* Loading State */
    .loading-state {
      text-align: center;
      padding: 60px 20px;
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e2e8f0;
      border-top-color: #0ea5e9;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 80px 20px;
      color: #94a3b8;
    }
    
    .empty-state .material-symbols-outlined {
      font-size: 64px;
    }
    
    .empty-subtitle {
      font-size: 14px;
      margin-top: 8px;
    }
    
    /* Questions List */
    .questions-list {
      padding: 0;
    }
    
    .question-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
      transition: all 0.2s;
    }
    
    .question-item:hover {
      background: #f8fafc;
    }
    
    .question-info {
      flex: 1;
    }
    
    .question-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    
    .question-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .question-icon.visual {
      background: #dbeafe;
      color: #2563eb;
    }
    
    .question-icon.sql {
      background: #dcfce7;
      color: #16a34a;
    }
    
    .question-icon .material-symbols-outlined {
      font-size: 22px;
    }
    
    .question-details {
      flex: 1;
    }
    
    .question-details h4 {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 8px;
      color: #0f172a;
    }
    
    .question-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #64748b;
      flex-wrap: wrap;
      align-items: center;
    }
    
    .question-table, .question-date {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .question-table .material-symbols-outlined,
    .question-date .material-symbols-outlined {
      font-size: 14px;
    }
    
    .question-table {
      padding: 4px 8px;
      background: #fef3c7;
      border-radius: 6px;
      color: #d97706;
      font-weight: 500;
    }
    
    .question-type-badge {
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 11px;
    }
    
    .question-type-badge.visual {
      background: #dbeafe;
      color: #2563eb;
    }
    
    .question-type-badge.sql {
      background: #dcfce7;
      color: #16a34a;
    }
    
    .question-actions {
      display: flex;
      gap: 8px;
      margin-left: 16px;
    }
    
    .btn-view {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      background: #0ea5e9;
      color: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .btn-view:hover {
      background: #0284c7;
      transform: translateY(-1px);
    }
    
    .btn-view .material-symbols-outlined {
      font-size: 16px;
    }
    
    .btn-delete {
      padding: 8px;
      border: none;
      background: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: all 0.2s;
      color: #94a3b8;
    }
    
    .btn-delete:hover {
      background: #fee2e2;
      color: #ef4444;
    }
    
    .btn-delete .material-symbols-outlined {
      font-size: 20px;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .saved-container {
        padding: 16px;
      }
      
      .filters-bar {
        flex-direction: column;
      }
      
      .question-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      
      .question-actions {
        margin-left: 0;
        width: 100%;
        justify-content: flex-end;
      }
      
      .question-header {
        width: 100%;
      }
      
      .question-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
    }
  `]
})
export class SavedQuestionsComponent implements OnInit, OnDestroy {
  savedQuestions: SavedQuestion[] = [];
  filteredQuestions: SavedQuestion[] = [];
  searchTerm: string = '';
  selectedType: string = "all";
  loading: boolean = true;

  private subscription: Subscription = new Subscription();

  constructor(
    private savedQuestionsService: SavedQuestionsService,
    private toastService: ToastService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadSavedQuestions();

    // Subscribe to changes
    this.subscription.add(
      this.savedQuestionsService.savedQuestions$.subscribe(questions => {
        this.savedQuestions = questions;
        this.applyFilters();
        this.loading = false;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadSavedQuestions() {
    this.loading = true;
    this.savedQuestionsService.loadSavedQuestions().subscribe({
      next: () => {
        // Data will be updated via the subscription
        
      },
      error: (error) => {
        console.error('Error loading saved questions:', error);
        this.toastService.showToast('Failed to load saved questions', 'error');
        this.loading = false;
      }
    });
  }

  applyFilters() {
    let filtered = [...this.savedQuestions];
    
    // Filter by type
    if (this.selectedType !== 'all') {
      filtered = filtered.filter(q => q.type === this.selectedType);
    }
    
    // Filter by search term
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(q => 
        (q.name || '').toString().toLowerCase().includes(term) ||
        ((q.table || q.tableName || '')).toString().toLowerCase().includes(term)
      );
    }
    
    // Sort by newest first
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    this.filteredQuestions = filtered;
    
  }
  
 loadQuestion(question: SavedQuestion) {
  // Store comprehensive question data to be loaded by query builder
  const questionData = {
    id: question.id,
    name: question.name,
    type: question.type,
    query: question.query,
    table: question.table,
    tableName: question.table,
    groupBy: question.groupBy || '',
    metric: question.metric || 'count',
    metricColumn: question.metricColumn || '',
    chartType: question.chartType || 'table',
    filters: question.filters || [],
    selectedColumns: question.selectedColumns || [],
    connectionId:question.connectionId || '',
    connectionName: question.connectionName || ''
  };
  
  // Clear any existing data first
  localStorage.removeItem('load_question');
  
  // Store the new question data
  localStorage.setItem('load_question', JSON.stringify(questionData));
  
  this.toastService.showToast(`Loading "${question.name}"...`, 'success');
  
  // Navigate to query builder
  this.router.navigate(['/query-builder']);
}
  
  deleteQuestion(id: number, event: Event) {
    event.stopPropagation();
    
    if (confirm('Are you sure you want to delete this saved question?')) {
      this.savedQuestionsService.deleteQuestion(id).subscribe({
        next: () => {
          this.toastService.showToast('Question deleted successfully', 'success');
          this.loadSavedQuestions(); // Reload the list
        },
        error: (error) => {
          console.error('Error deleting question:', error);
          this.toastService.showToast('Failed to delete question', 'error');
        }
      });
    }
  }
  
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    
    // Reset time portions to compare just the dates
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = today.getTime() - inputDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }
  
  getQuestionTypeIcon(type: string): string {
    return type === 'visual' ? 'bar_chart' : 'data_usage';
  }
  
  getQuestionTypeLabel(type: string): string {
    return type === 'visual' ? 'Visual Builder' : 'SQL Query';
  }
}