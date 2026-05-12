import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  
  private baseUrl = 'http://localhost:5182/api/Auth';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  // Add username subject
  private usernameSubject = new BehaviorSubject<string>(this.getStoredUsername());
  public username$ = this.usernameSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) { }

 private hasToken(): boolean {
    const token = localStorage.getItem('token');
    console.log('Has token?', !!token);
    return !!token;
  }

  private getStoredUsername(): string {
    return localStorage.getItem('username') || '';
  }

  getToken(): string | null {
    const token = localStorage.getItem('token');
    console.log('Getting token:', token ? `${token.substring(0, 20)}...` : 'null');
    return token;
  }
  
  getUsername(): string | null {
    return localStorage.getItem('username');
  }


  login(credentials: any): Observable<any> {
    console.log("creaditential",credentials)
    return this.http.post(`${this.baseUrl}/login`, credentials).pipe(
      tap((response: any) => {
        console.log("credentrial res",response);
        const token = response?.token ?? response?.Token ?? null;
        const username = response?.username ?? response?.Username ?? credentials.username ?? null;

        if (token) {
          localStorage.setItem('token', token);
          this.isAuthenticatedSubject.next(true);
        }

        if(username)
        {
          localStorage.setItem('username',username);
          this.usernameSubject.next(username);
        }
      })
    );
  }

  register(credentials: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, credentials);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }
}
