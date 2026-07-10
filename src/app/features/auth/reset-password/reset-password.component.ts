import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { OtpStore } from '../../../core/services/otp.service';
import { sanitizeEmail } from '../../../core/utils/sanitize.util';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent {
  email           = '';
  password        = '';
  confirmPassword = '';
  loading         = false;
  errorMsg        = '';
  successMsg      = '';
  showPassword    = false;
  showConfirm     = false;

  constructor(
    private router: Router,
    private route:  ActivatedRoute,
    private auth:   AuthService,
  ) {
    this.email = sanitizeEmail(this.route.snapshot.queryParams['email'] || '');

    // Must arrive with a verified OTP session
    const session = OtpStore.load();
    if (!session || !session.verified || session.email !== this.email || Date.now() > session.expires) {
      OtpStore.clear();
      this.router.navigate(['/forgot-password']);
    }
  }

  get passwordStrength(): { label: string; level: number; color: string } {
    const p = this.password;
    if (!p) return { label: '', level: 0, color: '' };
    let score = 0;
    if (p.length >= 8)          score++;
    if (p.length >= 12)         score++;
    if (/[A-Z]/.test(p))        score++;
    if (/[0-9]/.test(p))        score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { label: 'Weak',        level: 1, color: '#ef4444' };
    if (score <= 2) return { label: 'Fair',        level: 2, color: '#f97316' };
    if (score <= 3) return { label: 'Good',        level: 3, color: '#eab308' };
    if (score <= 4) return { label: 'Strong',      level: 4, color: '#22c55e' };
    return                       { label: 'Very Strong', level: 5, color: '#10b981' };
  }

  onSubmit() {
    this.errorMsg  = '';
    this.successMsg = '';

    if (!this.password || !this.confirmPassword) {
      this.errorMsg = 'Please fill in both password fields.';
      return;
    }
    if (this.password.length < 6) {
      this.errorMsg = 'Password must be at least 6 characters.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMsg = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    const ok = this.auth.resetPassword(this.email, this.password);

    if (ok) {
      OtpStore.clear();
      this.successMsg = 'Password reset! Signing you in…';
      this.auth.login(this.email, this.password);
      setTimeout(() => this.router.navigate(['/']), 1500);
    } else {
      this.errorMsg = 'Could not reset password. Please try again.';
    }
    this.loading = false;
  }
}
