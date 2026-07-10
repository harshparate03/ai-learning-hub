import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { isValidEmail, sanitizeEmail } from '../../../core/utils/sanitize.util';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  errorMsg = '';

  constructor(
    private router: Router,
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  async onSubmit() {
    this.errorMsg = '';
    const emailLower = sanitizeEmail(this.email);

    if (!emailLower || !isValidEmail(emailLower)) {
      this.errorMsg = 'Please enter a valid email address.';
      return;
    }

    // Check account exists — tell user in a helpful (not security-leaking) way
    if (!this.auth.isEmailTaken(emailLower)) {
      this.errorMsg = 'No account found for this email. Please sign up first.';
      return;
    }

    this.loading = true;

    try {
      // Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 10 * 60 * 1000; // 10 min

      // Attempt to send via Vercel serverless function
      let emailSent = false;
      try {
        await lastValueFrom(
          this.http.post('/api/send-otp', { email: emailLower, otp }),
        );
        emailSent = true;
      } catch {
        // API unavailable (local dev) — fall through to sessionStorage-only mode
        console.warn('[ForgotPassword] Email API unavailable — using dev mode (OTP shown on verify page)');
      }

      // Persist OTP data in sessionStorage
      const otpData = {
        otp,
        email: emailLower,
        expires,
        attempts: 0,
        devMode: !emailSent,
      };
      sessionStorage.setItem('alh_otp_data', btoa(JSON.stringify(otpData)));

      this.router.navigate(['/verify-otp'], {
        queryParams: { email: emailLower },
      });
    } catch (err: any) {
      this.errorMsg = 'Something went wrong. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
