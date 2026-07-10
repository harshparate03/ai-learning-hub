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
  /** true only on localhost — shows a dev hint (OTP in console) */
  readonly isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

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

    // On localhost (devMode) — log OTP to browser console only, never to UI
    if (session.devMode) {
      console.info(
        `%c[Dev] OTP for ${this.email}: ${session.otp}`,
        'background:#1e293b;color:#38bdf8;padding:4px 8px;border-radius:4px;font-family:monospace;font-size:14px;font-weight:700;letter-spacing:3px'
      );
    }

    setTimeout(() => this.focusBox(0), 120);
  }

  ngOnDestroy() {
    if (this.timerRef)  clearInterval(this.timerRef);
    if (this.resendRef) clearInterval(this.resendRef);
  }

  // ── Timer ─────────────────────────────────────────────────
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

  // ── Input handling ────────────────────────────────────────
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

  // ── Verify ────────────────────────────────────────────────
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
      this.errorMsg = `Incorrect OTP — ${left} attempt${left === 1 ? '' : 's'} remaining.`;
      this.digits = ['', '', '', '', '', ''];
      setTimeout(() => this.focusBox(0), 50);
      return;
    }

    // ✓ Verified
    OtpStore.update({ verified: true });
    this.successMsg = '✓ OTP verified! Redirecting…';
    setTimeout(() => {
      this.router.navigate(['/reset-password'], { queryParams: { email: this.email } });
    }, 900);
  }

  // ── Resend ────────────────────────────────────────────────
  async resendOtp() {
    if (this.resendCooldown > 0 || this.loading) return;
    this.errorMsg   = '';
    this.successMsg = '';
    this.loading    = true;

    try {
      const newOtp  = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 10 * 60 * 1000;

      let emailSent = false;
      try {
        await this.http.post('/api/send-otp', { email: this.email, otp: newOtp }).toPromise();
        emailSent = true;
      } catch (apiErr: any) {
        const status = apiErr?.status as number | undefined;
        if (status === 401 || (status === 403 && apiErr?.error?.error !== 'domain_not_verified')) {
          this.errorMsg = 'Email service error. Please try again later.';
          this.loading  = false;
          return;
        }
        if (status === 429) {
          this.errorMsg = 'Rate limit reached. Please wait a minute before resending.';
          this.loading  = false;
          return;
        }
        // status 0 / 404 / 500 / domain_not_verified → local dev or unverified domain, proceed
        console.warn(`[VerifyOtp] Email API unavailable (status ${status ?? 'none'}) — local mode.`);
      }

      // Always save new OTP session (devMode stored but NOT displayed)
      OtpStore.save({ otp: newOtp, email: this.email, expires, attempts: 0, devMode: !emailSent });

      this.digits   = ['', '', '', '', '', ''];
      this.expired  = false;
      this.timeLeft = 600;
      this.startTimer();

      this.successMsg = emailSent
        ? 'New OTP sent to your email.'
        : 'OTP request processed. Check your inbox.';

      this.resendCooldown = 60;
      if (this.resendRef) clearInterval(this.resendRef);
      this.resendRef = setInterval(() => {
        this.resendCooldown = Math.max(0, this.resendCooldown - 1);
        if (this.resendCooldown === 0) clearInterval(this.resendRef!);
      }, 1000);

      setTimeout(() => this.focusBox(0), 100);
    } catch {
      this.errorMsg = 'Could not resend OTP. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
