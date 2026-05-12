import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth';

export interface SavedQuestion {
  table: any;
  id: number;
  name: string;
  type: string;
  query: string;
  tableName: string;
  groupBy?:  string | null | undefined;
  metric?: string;
  metricColumn?: string;
  chartType?: string;
  filters?: any[];
  selectedColumns?: string[];
  connectionId?: number;
  connectionName?: string;
  createdAt: string;
  userId: number;
}

@Injectable({
  providedIn: 'root'
})
export class SavedQuestionsService {
  private apiUrl = 'http://localhost:5182/api/SavedQuestions';
  private savedQuestionsSubject = new BehaviorSubject<SavedQuestion[]>([]);
  public savedQuestions$ = this.savedQuestionsSubject.asObservable();


  private isDataLoaded =false;
  private currentUserId: number | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Listen for logout events to clear cache
    this.authService.currentUser$.subscribe(user => {
      const newUserId = user?.id || null;
      
      // If user ID changed (logout or login as different user), clear cache
      if (this.currentUserId !== newUserId) {
        console.log(`User changed from ${this.currentUserId} to ${newUserId}, clearing cache`);
        this.clearCache();
        this.currentUserId = newUserId;
      }
    });
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) {
      console.error('No token found!');
    }
    
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  clearCache(): void {
    this.isDataLoaded = false;
    this.savedQuestionsSubject.next([]);
    // Don't clear localStorage immediately as it might be needed for offline, but mark it as invalid
    localStorage.removeItem('saved_questions_backup');
    localStorage.removeItem('saved_questions_user_id');
  }


loadSavedQuestions(forceRefresh: boolean = false): Observable<SavedQuestion[]> {
    const currentUser = this.authService.getCurrentUser();
    const userId = currentUser?.id;
    
    // If forceRefresh is requested, clear cache and reload
    if (forceRefresh) {
      this.isDataLoaded = false;
    }
    
    // Check if we have cached data for this specific user
    const cachedUserId = localStorage.getItem('saved_questions_user_id');
    
    // Return cached data if already loaded for the same user and not forcing refresh
    if (this.isDataLoaded && !forceRefresh && this.savedQuestionsSubject.value.length > 0 && cachedUserId === String(userId)) {
      console.log('Returning cached data for user:', userId);
      return of(this.savedQuestionsSubject.value);
    }
    
    // If user ID changed, clear old cache
    if (cachedUserId !== String(userId)) {
      console.log('User ID mismatch, clearing old cache');
      localStorage.removeItem('saved_questions_backup');
      this.savedQuestionsSubject.next([]);
      this.isDataLoaded = false;
    }
    
    console.log('Loading saved questions from server for user:', userId);
    return this.http.get<SavedQuestion[]>(this.apiUrl, { headers: this.getHeaders() }).pipe(
      map((questions) => {
        const serverRaw = (questions || []) as any[];
        if (serverRaw.length > 0) {
          const server = serverRaw.map(q => ({
            id: q.Id ?? q.id,
            name: q.Name ?? q.name,
            type: q.Type ?? q.type,
            query: q.Query ?? q.query,
            table: q.TableName ?? q.tableName ?? q.table,
            tableName: q.TableName ?? q.tableName ?? q.table,
            groupBy: q.GroupBy ?? q.groupBy,
            metric: q.Metric ?? q.metric,
            metricColumn: q.MetricColumn ?? q.metricColumn,
            chartType: q.ChartType ?? q.chartType,
            filters: q.Filters ?? q.filters ?? (q.FiltersJson ? JSON.parse(q.FiltersJson) : undefined),
            selectedColumns: q.SelectedColumns ?? q.selectedColumns ?? (q.SelectedColumnsJson ? JSON.parse(q.SelectedColumnsJson) : undefined),
            connectionId: q.ConnectionId ?? q.connectionId,
            connectionName: q.ConnectionName ?? q.connectionName,
            createdAt: (q.CreatedAt ?? q.createdAt)?.toString() ?? new Date().toISOString(),
            userId: q.UserId ?? q.userId ?? userId
          })) as SavedQuestion[];
          
          // Cache the server data to localStorage with user ID
          localStorage.setItem('saved_questions_backup', JSON.stringify(server));
          localStorage.setItem('saved_questions_user_id', String(userId));
          this.isDataLoaded = true;
          return server.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        
        // If server returned empty, try backup cache for the same user
        const backup = localStorage.getItem('saved_questions_backup');
        const backupUserId = localStorage.getItem('saved_questions_user_id');
        
        if (backup && backupUserId === String(userId)) {
          const backupQuestions = JSON.parse(backup) as SavedQuestion[];
          if (backupQuestions.length > 0) {
            console.log('Using backup cached data for user:', userId);
            this.isDataLoaded = true;
            return backupQuestions;
          }
        }
        
        // No data found for this user
        this.isDataLoaded = true;
        return [];
      }),
      tap(questions => {
        console.log('Questions loaded for user:', userId, 'count:', questions.length);
        this.savedQuestionsSubject.next(questions);
      }),
      catchError(error => {
        console.error('Error loading questions:', error);
        if (error.status === 401) {
          this.authService.logout();
        }
        
        // Try backup cache for the same user on error
        const backup = localStorage.getItem('saved_questions_backup');
        const backupUserId = localStorage.getItem('saved_questions_user_id');
        
        if (backup && backupUserId === String(userId)) {
          const backupQuestions = JSON.parse(backup) as SavedQuestion[];
          if (backupQuestions.length > 0) {
            console.log('Using backup on error for user:', userId);
            this.savedQuestionsSubject.next(backupQuestions);
            return of(backupQuestions);
          }
        }
        
        // Return empty array for new user with no data
        this.savedQuestionsSubject.next([]);
        return throwError(() => error);
      })
    );
  }

   // Add method to force refresh when needed (like after saving/deleting)
  refreshQuestions(): Observable<SavedQuestion[]> {
    this.isDataLoaded = false;
    return this.loadSavedQuestions(true);
  }

  getSavedQuestions(): SavedQuestion[] {
    return this.savedQuestionsSubject.value;
  }

   saveQuestion(question: Omit<SavedQuestion, 'id' | 'createdAt' | 'userId'>): Observable<SavedQuestion> {
    const currentUser = this.authService.getCurrentUser();
    console.log('Saving question for user:', currentUser?.id);
    
    return this.http.post<SavedQuestion>(this.apiUrl, question, { headers: this.getHeaders() }).pipe(
      tap(savedQuestion => {
        console.log('Question saved:', savedQuestion);
        const currentQuestions = this.savedQuestionsSubject.value;
        this.savedQuestionsSubject.next([savedQuestion, ...currentQuestions]);
        // Update backup cache with user ID
        localStorage.setItem('saved_questions_backup', JSON.stringify(this.savedQuestionsSubject.value));
        localStorage.setItem('saved_questions_user_id', String(currentUser?.id));
        this.isDataLoaded = true;
      }),
      catchError(error => {
        console.error('Error saving question:', error);
        return throwError(() => error);
      })
    );
  }

  deleteQuestion(id: number): Observable<void> {
     const currentUser = this.authService.getCurrentUser();
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      tap(() => {
        const currentQuestions = this.savedQuestionsSubject.value;
        const filteredQuestions = currentQuestions.filter(q => q.id !== id);
        this.savedQuestionsSubject.next(filteredQuestions);

        // Update backup cache
        localStorage.setItem('saved_questions_backup', JSON.stringify(filteredQuestions));
        localStorage.setItem('saved_questions_user_id', String(currentUser?.id));
      }),
      catchError(error => {
        console.error('Error deleting question:', error);
        // If backend delete failed, attempt to remove from local storage and update subject
        try {
          const local = JSON.parse(localStorage.getItem('saved_questions') || '[]') as SavedQuestion[];
          const filteredLocal = local.filter(q => q.id !== id);
          localStorage.setItem('saved_questions', JSON.stringify(filteredLocal));
          localStorage.setItem('saved_questions_backup', JSON.stringify(filteredLocal));
          localStorage.setItem('saved_questions_user_id', String(currentUser?.id));
          const currentQuestions = this.savedQuestionsSubject.value;
          const filteredQuestions = currentQuestions.filter(q => q.id !== id);
          this.savedQuestionsSubject.next(filteredQuestions);
        } catch (e) {
          // ignore
        }
        return of(void 0);
      })
    );
  }

  getQuestionById(id: number): Observable<SavedQuestion> {
    return this.http.get<SavedQuestion>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      catchError(error => {
        console.error('Error getting question:', error);
        return throwError(() => error);
      })
    );
  }
}