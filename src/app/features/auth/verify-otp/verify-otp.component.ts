import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { OtpStore } from '../../../core/services/otp.service';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './verify-otp.component.html',
  styleUrl: './verify-otp.component.css',
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  email          = '';
  digits         = ['', '', '', '', '', ''];
  loading        = false;
  errorMsg       = '';
  successMsg     = '';
  timeLeft       = 600;
  resendCooldown = 0;
  expired        = false;

  private readonly otpApiUrl = this.localOtpApiUrl();

  private timerRef:  ReturnType<typeof setInterval> | null = null;
  private resendRef: ReturnType<typeof setInterval> | null = null;

  constructor(
    private router: Router,
    private route:  ActivatedRoute,
    private http:   HttpClient,
  ) {}

  ngOnInit() {
    this.email = this.route.snapshot.queryParams['email'] || '';

    const session = OtpStore.load();
    if (!session) { this.router.navigate(['/forgot-password']); return; }
    if (session.email !== this.email) { this.router.navigate(['/forgot-password']); return; }

    const remaining = Math.floor((session.expires - Date.now()) / 1000);
    if (remaining <= 0) {
      this.expired  = true;
      this.timeLeft = 0;
      this.errorMsg = 'OTP has expired. Please request a new one.';
      return;
    }

    this.timeLeft = remaining;
    this.startTimer();
    setTimeout(() => this.focusBox(0), 120);
  }

  ngOnDestroy() {
    if (this.timerRef)  clearInterval(this.timerRef);
    if (this.resendRef) clearInterval(this.resendRef);
  }

  private startTimer() {
    if (this.timerRef) clearInterval(this.timerRef);
    this.timerRef = setInterval(() => {
      this.timeLeft = Math.max(0, this.timeLeft - 1);
      if (this.timeLeft === 0) {
        clearInterval(this.timerRef!);
        this.expired  = true;
        this.errorMsg = 'OTP has expired. Please request a new one.';
      }
    }, 1000);
  }

  formatTime(s: number): string {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }

  onDigitInput(event: Event, i: number) {
    const el  = event.target as HTMLInputElement;
    const val = el.value.replace(/\D/g, '').slice(-1);
    this.digits[i] = val;
    el.value = val;
    if (val && i < 5) this.focusBox(i + 1);
    if (this.digits.join('').length === 6) this.onVerify();
  }

  onKeyDown(event: KeyboardEvent, i: number) {
    if (event.key === 'Backspace' && !this.digits[i] && i > 0) {
      this.digits[i - 1] = '';
      this.focusBox(i - 1);
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) || '';
    text.split('').forEach((ch, idx) => { this.digits[idx] = ch; });
    setTimeout(() => this.focusBox(Math.min(text.length, 5)), 0);
    if (text.length === 6) setTimeout(() => this.onVerify(), 80);
  }

  private focusBox(i: number) {
    (document.getElementById(`otp-${i}`) as HTMLInputElement)?.focus();
  }

  onVerify() {
    this.errorMsg = '';
    const entered = this.digits.join('');
    if (entered.length !== 6 || this.expired || this.successMsg) return;

    const session = OtpStore.load();
    if (!session) { this.errorMsg = 'Session expired. Please start over.'; return; }

    if (Date.now() > session.expires) {
      this.expired  = true;
      this.errorMsg = 'OTP has expired. Please request a new one.';
      return;
    }

    const attempts = (session.attempts || 0) + 1;
    if (attempts > 5) {
      OtpStore.clear();
      this.errorMsg = 'Too many incorrect attempts. Please request a new OTP.';
      return;
    }

    if (entered !== session.otp) {
      OtpStore.update({ attempts });
      const left = 5 - attempts;
      this.errorMsg = `Incorrect OTP - ${left} attempt${left === 1 ? '' : 's'} remaining.`;
      this.digits = ['', '', '', '', '', ''];
      setTimeout(() => this.focusBox(0), 50);
      return;
    }

    OtpStore.update({ verified: true });
    this.successMsg = 'OTP verified! Redirecting...';
    setTimeout(() => {
      this.router.navigate(['/reset-password'], { queryParams: { email: this.email } });
    }, 900);
  }

  async resendOtp() {
    if (this.resendCooldown > 0 || this.loading) return;
    this.errorMsg   = '';
    this.successMsg = '';
    this.loading    = true;

    try {
      const newOtp  = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 10 * 60 * 1000;
      await this.sendOtp(newOtp);

      OtpStore.save({ otp: newOtp, email: this.email, expires, attempts: 0 });

      this.digits   = ['', '', '', '', '', ''];
      this.expired  = false;
      this.timeLeft = 600;
      this.startTimer();
      this.successMsg = 'New OTP sent to your email.';

      this.resendCooldown = 60;
      if (this.resendRef) clearInterval(this.resendRef);
      this.resendRef = setInterval(() => {
        this.resendCooldown = Math.max(0, this.resendCooldown - 1);
        if (this.resendCooldown === 0) clearInterval(this.resendRef!);
      }, 1000);

      setTimeout(() => this.focusBox(0), 100);
    } catch (err: any) {
      this.errorMsg = this.otpErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  private async sendOtp(otp: string): Promise<void> {
    await this.http.post(this.otpApiUrl, { email: this.email, otp }).toPromise();
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
    if (status === 0) return 'Local email API is not running. Start the app with npm start, or run npm run proxy with ng serve.';
    if (status === 404) return 'Email API route was not found. On localhost, start npm start. On Vercel, redeploy after adding the api/send-otp.js function.';
    if (status === 401 || status === 403) return 'Email service error. Please try again later.';
    if (status === 429) return 'Rate limit reached. Please wait a minute before resending.';
    if (status === 400) return message || 'Invalid OTP request. Please try again.';
    return message || 'Could not send a new OTP. Please try again later.';
  }
}
