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
  loading = false;

  redirectUrl = '/';
  constructor(
    private auth:   AuthService,
    private router: Router,
    private route:  ActivatedRoute
  ) {
    // Validate redirect — must be a local path starting with /
    this.route.queryParams.subscribe(p => {
      const raw = p['redirect'];
      if (raw && typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) {
        this.redirectUrl = raw;
      }
    });

    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl(this.redirectUrl);
    }
  }

  async signup() {
    if (this.loading) return;
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

    if (this.password.length < 8 || this.password.length > 128) {
      this.errorMsg = 'Password must contain 8 to 128 characters.';
      return;
    }

    this.loading = true;
    try {
      await this.auth.signup(this.email, this.password);
      this.successMsg = 'Account created! Signing you in...';
      // Auto-login after signup, then redirect to original destination
      setTimeout(() => this.router.navigateByUrl(this.redirectUrl), 1200);
    } catch (error: any) { this.errorMsg = error.error?.error || 'Could not create account. Please try again.'; }
    finally { this.loading = false; }
  }
}
