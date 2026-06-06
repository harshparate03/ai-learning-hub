import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  email = '';
  password = '';
  errorMsg = '';

  constructor(private auth: AuthService, private router: Router) {}

  login() {
    this.errorMsg = '';

    if (!this.email || !this.password) {
      this.errorMsg = 'Please fill in all fields.';
      return;
    }

    const success = this.auth.login(this.email, this.password);
    if (success) {
      this.router.navigate(['/']);
    } else {
      this.errorMsg = 'Invalid email or password.';
    }
  }
}
