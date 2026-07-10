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

  private readonly otpApiUrl = this.localOtpApiUrl();


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
      const expires = Date.now() + 10 * 60 * 1000;
      await this.sendOtp(emailLower, otp);

      OtpStore.save({
        otp,
        email:    emailLower,
        expires,
        attempts: 0,
      });

      this.router.navigate(['/verify-otp'], { queryParams: { email: emailLower } });
    } catch (err: any) {
      this.errorMsg = this.otpErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  private async sendOtp(email: string, otp: string): Promise<void> {
    await this.http.post(this.otpApiUrl, { email, otp }).toPromise();
  }

  private localOtpApiUrl(): string {
    if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      return 'http://localhost:3001/api/send-otp';
    }
    return '/api/send-otp';
  }

  private otpErrorMessage(err: any): string {
    const status = err?.status as number | undefined;
    const code = err?.error?.error as string | undefined;
    const message = err?.error?.message || err?.error?.error || err?.message || '';
    const lowerMessage = String(message).toLowerCase();

    if (code === 'email_service_not_configured') {
      return 'Password reset email is not configured on the server. Please contact the app owner.';
    }
    if (
      code === 'domain_not_verified' ||
      code === 'resend_sender_not_verified' ||
      lowerMessage.includes('testing emails') ||
      lowerMessage.includes('verify a domain') ||
      lowerMessage.includes('own email address')
    ) {
      return 'Email OTP is not enabled for this recipient yet. Verify a domain in Resend, set RESEND_FROM_EMAIL, then redeploy.';
    }
    if (status === 401 || status === 403) {
      return 'Email service authentication failed. Please contact the app owner.';
    }
    if (status === 429) {
      return 'Email rate limit reached. Please wait a minute and try again.';
    }
    if (status === 0) {
      return 'Local email API is not running. Start the app with npm start, or run npm run proxy with ng serve.';
    }
    if (status === 404) {
      return 'Email API route was not found. On localhost, start npm start. On Vercel, redeploy after adding the api/send-otp.js function.';
    }
    if (status === 400) {
      return message || 'Invalid password reset request. Please check the email and try again.';
    }
    return message || 'Could not send the password reset email. Please try again later.';
  }
}
