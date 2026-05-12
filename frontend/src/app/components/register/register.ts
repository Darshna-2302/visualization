import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent {
  username = '';
  password = '';
  error = '';
  loading = false;
  showPassword = false;
  success = '';

  constructor(private router: Router, private auth: AuthService) {}

  goToLogin() {
    this.router.navigate(['/login']);
  }

  register() {
    this.error = '';
    this.loading = true;
    this.auth.register({ username: this.username, password: this.password }).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Account created — you can now sign in.';
        setTimeout(() => this.router.navigate(['/login']), 1200);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.Message ?? 'Registration failed';
      }
    });
  }

  toggleShow() { this.showPassword = !this.showPassword; }
}
