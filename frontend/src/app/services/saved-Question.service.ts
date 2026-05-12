import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, throwError } from 'rxjs';
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
      tap(questions => {
        console.log('Questions loaded:', questions);
        this.savedQuestionsSubject.next(questions);
      }),
      catchError(error => {
        console.error('Error loading questions:', error);
        if (error.status === 401) {
          this.authService.logout();
        }
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
        return throwError(() => error);
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