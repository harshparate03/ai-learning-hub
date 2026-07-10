import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { OtpStore } from '../../../core/services/otp.service';
import { isValidEmail, sanitizeEmail } from '../../../core/utils/sanitize.util';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  email    = '';
  loading  = false;
  errorMsg = '';

  constructor(
    private router: Router,
    private http:   HttpClient,
    private auth:   AuthService,
  ) {}

  async onSubmit() {
    this.errorMsg = '';
    const emailLower = sanitizeEmail(this.email.trim());

    if (!emailLower || !isValidEmail(emailLower)) {
      this.errorMsg = 'Please enter a valid email address.';
      return;
    }

    if (!this.auth.isEmailTaken(emailLower)) {
      this.errorMsg = 'No account found for this email. Please sign up first.';
      return;
    }

    this.loading = true;

    try {
      const otp     = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 10 * 60 * 1000; // 10 min

      // Try to send via Vercel serverless API
      let emailSent = false;
      try {
        await this.http.post('/api/send-otp', { email: emailLower, otp }).toPromise();
        emailSent = true;
      } catch {
        // Expected in local dev — no server running
        console.warn('[ForgotPassword] Email API unavailable — OTP will be shown on verify page.');
      }

      // Persist using UTF-8-safe encoding
      OtpStore.save({
        otp,
        email:    emailLower,
        expires,
        attempts: 0,
        devMode:  !emailSent,
      });

      this.router.navigate(['/verify-otp'], { queryParams: { email: emailLower } });
    } catch {
      this.errorMsg = 'Something went wrong. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
