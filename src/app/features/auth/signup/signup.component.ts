import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css'
})
export class SignupComponent {

  email           = '';
  password        = '';
  confirmPassword = '';
  errorMsg        = '';
  successMsg      = '';

  redirectUrl = '/';
  constructor(
    private auth:   AuthService,
    private router: Router,
    private route:  ActivatedRoute
  ) {
    this.route.queryParams.subscribe(p => {
      if (p['redirect']) this.redirectUrl = p['redirect'];
    });

    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl(this.redirectUrl);
    }
  }

  signup() {
    this.errorMsg  = '';
    this.successMsg = '';

    if (!this.email || !this.password || !this.confirmPassword) {
      this.errorMsg = 'Please fill in all fields.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMsg = 'Passwords do not match.';
      return;
    }

    if (this.password.length < 6) {
      this.errorMsg = 'Password must be at least 6 characters.';
      return;
    }

    const success = this.auth.signup(this.email, this.password);
    if (success) {
      this.successMsg = 'Account created! Signing you in...';
      // Auto-login after signup, then redirect to original destination
      this.auth.login(this.email, this.password);
      setTimeout(() => this.router.navigateByUrl(this.redirectUrl), 1200);
    } else {
      this.errorMsg = 'Email already registered.';
    }
  }
}
