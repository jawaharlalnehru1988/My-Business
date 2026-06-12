import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RegisterRequest } from '../models/auth.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  request: RegisterRequest = {
    email: '',
    password: '',
    businessName: '',
    gstNumber: '',
    contactInfo: '',
    address: ''
  };
  
  errorMessage = signal<string | null>(null);
  
  private authService = inject(AuthService);
  private router = inject(Router);

  register() {
    this.errorMessage.set(null);
    this.authService.register(this.request).subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (err: any) => {
        this.errorMessage.set(err.error?.message || 'Registration failed.');
      }
    });
  }
}
