import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
    const token = this.auth.getToken();
    if (token) return true;
    return this.router.parseUrl('/login');
  }
}
