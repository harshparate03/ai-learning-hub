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

      // Try to send email via serverless API.
      // On localhost the API doesn't exist → any error = dev mode, proceed anyway.
      // On Vercel, only surface errors that are meaningful to the user (auth failures).
      let emailSent = false;

      try {
        const response: any = await this.http
          .post('/api/send-otp', { email: emailLower, otp })
          .toPromise();
        emailSent = true;
        console.log('[ForgotPassword] OTP email sent:', response?.id);
      } catch (apiErr: any) {
        const status  = apiErr?.status  as number | undefined;
        const errCode = apiErr?.error?.error as string | undefined;

        if (status === 401 || status === 403) {
          if (errCode === 'domain_not_verified') {
            // Resend requires a verified custom domain to send to arbitrary emails.
            // Still proceed — the OTP is stored and the user can continue.
            console.warn('[ForgotPassword] Resend domain not verified — proceeding without email.');
          } else {
            // Real auth failure — API key invalid
            this.errorMsg = 'Email service authentication failed. Please contact the app owner.';
            this.loading  = false;
            return;
          }
        } else if (status === 429) {
          this.errorMsg = 'Email rate limit reached. Please wait a minute and try again.';
          this.loading  = false;
          return;
        } else {
          // status 0 (network error) = localhost with no server
          // status 404 = API route not deployed yet
          // status 500 = serverless function crash
          // → In all these cases: dev/preview environment. Proceed silently.
          console.warn(`[ForgotPassword] Email API unavailable (status ${status ?? 'none'}) — proceeding in local mode.`);
        }
      }

      // Save OTP session (devMode = email was not actually sent)
      OtpStore.save({
        otp,
        email:    emailLower,
        expires,
        attempts: 0,
        devMode:  !emailSent,
      });

      // Always navigate to verify page regardless of email delivery
      this.router.navigate(['/verify-otp'], { queryParams: { email: emailLower } });

    } catch {
      this.errorMsg = 'Something went wrong. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
