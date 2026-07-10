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
  email      = '';
  loading    = false;
  errorMsg   = '';
  successMsg = '';

  constructor(
    private router: Router,
    private http:   HttpClient,
    private auth:   AuthService,
  ) {}

  async onSubmit() {
    this.errorMsg   = '';
    this.successMsg = '';
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

      let emailSent = false;
      let emailError = '';

      try {
        await this.http.post('/api/send-otp', { email: emailLower, otp }).toPromise();
        emailSent = true;
      } catch (apiErr: any) {
        const status = apiErr?.status;
        const errCode = apiErr?.error?.error;

        if (status === 403 && errCode === 'domain_not_verified') {
          // Resend requires a verified custom domain to send to arbitrary emails
          emailError = 'Email delivery requires a verified sender domain. Configure RESEND_FROM_EMAIL in Vercel environment variables with a verified domain. Contact the app owner.';
        } else if (status === 401 || status === 403) {
          emailError = 'Email service authentication failed. Please contact the app owner.';
        } else if (status === 429) {
          emailError = 'Email rate limit reached. Please try again in a few minutes.';
        } else if (status === 0 || !status) {
          // Local dev — API not available, proceed silently
          console.warn('[ForgotPassword] API not reachable (local dev).');
        } else {
          emailError = `Email sending failed (${status}). Please try again.`;
        }
      }

      if (emailError) {
        this.errorMsg = emailError;
        this.loading  = false;
        return;
      }

      // Store session (devMode only on local dev without server)
      OtpStore.save({ otp, email: emailLower, expires, attempts: 0, devMode: !emailSent });

      this.router.navigate(['/verify-otp'], { queryParams: { email: emailLower } });
    } catch {
      this.errorMsg = 'Something went wrong. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
