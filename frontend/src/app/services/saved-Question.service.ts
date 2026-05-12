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

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

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

  loadSavedQuestions(): Observable<SavedQuestion[]> {
    console.log('Loading saved questions...');
    return this.http.get<SavedQuestion[]>(this.apiUrl, { headers: this.getHeaders() }).pipe(
      map((questions) => {
        const serverRaw = (questions || []) as any[];
        if (serverRaw.length > 0) {
          // Normalize server response (API uses PascalCase) to the frontend shape (camelCase)
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
            userId: q.UserId ?? q.userId ?? 0
          })) as SavedQuestion[];

          // If server returned items, prefer server list (authoritative)
          return server.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        // If server returned empty, fall back to local saved questions
        const local = JSON.parse(localStorage.getItem('saved_questions') || '[]') as SavedQuestion[];
        const uniqLocal = Array.from(new Map((local || []).map(l => [l.id ?? l.createdAt ?? JSON.stringify(l), l])).values());
        return uniqLocal.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }),
      tap(questions => {
        console.log('Questions loaded (server-preferred or local fallback):', questions);
        this.savedQuestionsSubject.next(questions);
      }),
      catchError(error => {
        console.error('Error loading questions:', error);
        if (error.status === 401) {
          this.authService.logout();
        }
        // fallback to local saved questions (deduped)
        const local = JSON.parse(localStorage.getItem('saved_questions') || '[]') as SavedQuestion[];
        const uniqLocal = Array.from(new Map((local || []).map(l => [l.id ?? l.createdAt ?? JSON.stringify(l), l])).values());
        this.savedQuestionsSubject.next(uniqLocal);
        return throwError(() => error);
      })
    );
  }

  getSavedQuestions(): SavedQuestion[] {
    return this.savedQuestionsSubject.value;
  }

  saveQuestion(question: Omit<SavedQuestion, 'id' | 'createdAt' | 'userId'>): Observable<SavedQuestion> {
    console.log('Saving question:', question);
    return this.http.post<SavedQuestion>(this.apiUrl, question, { headers: this.getHeaders() }).pipe(
      tap(savedQuestion => {
        console.log('Question saved:', savedQuestion);
        const currentQuestions = this.savedQuestionsSubject.value;
        this.savedQuestionsSubject.next([savedQuestion, ...currentQuestions]);
      }),
      catchError(error => {
        console.error('Error saving question:', error);
        return throwError(() => error);
      })
    );
  }

  deleteQuestion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      tap(() => {
        const currentQuestions = this.savedQuestionsSubject.value;
        const filteredQuestions = currentQuestions.filter(q => q.id !== id);
        this.savedQuestionsSubject.next(filteredQuestions);
      }),
      catchError(error => {
        console.error('Error deleting question:', error);
        // If backend delete failed, attempt to remove from local storage and update subject
        try {
          const local = JSON.parse(localStorage.getItem('saved_questions') || '[]') as SavedQuestion[];
          const filteredLocal = local.filter(q => q.id !== id);
          localStorage.setItem('saved_questions', JSON.stringify(filteredLocal));
          // Update in-memory subject as well
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