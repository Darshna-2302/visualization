import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatCheckboxModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  credentials = { username: '', password: '' };
  errorMessage = '';

  showPassword = false;
  rememberMe = false;

  constructor(private authService: AuthService, public router: Router) {}

  login() {
    this.authService.login(this.credentials).subscribe({
      next: () => {
        this.router.navigate(['/connections']);
      },
      error: (err) => {
        this.errorMessage = 'Invalid username or password';
      }
    });
  }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }
}
