import { Component, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = signal<string | null>(null);
  
  private authService = inject(AuthService);
  private router = inject(Router);

  login() {
    this.errorMessage.set(null);
    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        if (res.role === 'ROLE_SUPER_ADMIN') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err: any) => {
        this.errorMessage.set('Invalid credentials.');
      }
    });
  }
}
