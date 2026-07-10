import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './verify-otp.component.html',
  styleUrl: './verify-otp.component.css',
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  email = '';
  digits: string[] = ['', '', '', '', '', ''];
  loading = false;
  errorMsg = '';
  successMsg = '';
  timeLeft = 600; // 10 minutes
  resendCooldown = 0;
  expired = false;
  /** Show OTP in dev mode when email API is unavailable */
  devOtp = '';

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private resendTimerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.email = this.route.snapshot.queryParams['email'] || '';

    const raw = sessionStorage.getItem('alh_otp_data');
    if (!raw) {
      this.router.navigate(['/forgot-password']);
      return;
    }

    try {
      const data = JSON.parse(atob(raw));

      if (data.email !== this.email) {
        this.router.navigate(['/forgot-password']);
        return;
      }

      const remaining = Math.floor((data.expires - Date.now()) / 1000);
      if (remaining <= 0) {
        this.expired = true;
        this.timeLeft = 0;
        this.errorMsg = 'OTP has expired. Please request a new one.';
        return;
      }

      this.timeLeft = remaining;

      // Dev mode: show OTP directly if email could not be sent
      if (data.devMode) {
        this.devOtp = data.otp;
      }
    } catch {
      this.router.navigate(['/forgot-password']);
      return;
    }

    this.startTimer();
    setTimeout(() => (document.getElementById('otp-0') as HTMLInputElement)?.focus(), 100);
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.resendTimerInterval) clearInterval(this.resendTimerInterval);
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timeLeft = Math.max(0, this.timeLeft - 1);
      if (this.timeLeft === 0) {
        clearInterval(this.timerInterval!);
        this.expired = true;
        this.errorMsg = 'OTP has expired. Please request a new one.';
      }
    }, 1000);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  onDigitInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    this.digits[index] = val;
    input.value = val;
    if (val && index < 5) {
      (document.getElementById(`otp-${index + 1}`) as HTMLInputElement)?.focus();
    }
  }

  onKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      (document.getElementById(`otp-${index - 1}`) as HTMLInputElement)?.focus();
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const paste = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) || '';
    paste.split('').forEach((ch, i) => {
      if (i < 6) this.digits[i] = ch;
    });
    const lastFilled = Math.min(paste.length, 5);
    setTimeout(() => (document.getElementById(`otp-${lastFilled}`) as HTMLInputElement)?.focus(), 0);
  }

  onVerify() {
    this.errorMsg = '';
    const entered = this.digits.join('');
    if (entered.length !== 6) return;

    const raw = sessionStorage.getItem('alh_otp_data');
    if (!raw) {
      this.errorMsg = 'Session expired. Please restart the password reset flow.';
      return;
    }

    let data: any;
    try {
      data = JSON.parse(atob(raw));
    } catch {
      this.errorMsg = 'Invalid session. Please restart.';
      return;
    }

    // Expiry check
    if (Date.now() > data.expires) {
      this.expired = true;
      this.errorMsg = 'OTP has expired. Please request a new one.';
      return;
    }

    // Attempt limiting (max 5 attempts)
    data.attempts = (data.attempts || 0) + 1;
    if (data.attempts > 5) {
      sessionStorage.removeItem('alh_otp_data');
      this.errorMsg = 'Too many incorrect attempts. Please request a new OTP.';
      return;
    }

    if (entered !== data.otp) {
      // Persist updated attempt count
      sessionStorage.setItem('alh_otp_data', btoa(JSON.stringify(data)));
      this.errorMsg = `Incorrect OTP. ${5 - data.attempts} attempt${5 - data.attempts === 1 ? '' : 's'} remaining.`;
      return;
    }

    // ✓ Verified — mark as verified so reset-password page can proceed
    data.verified = true;
    sessionStorage.setItem('alh_otp_data', btoa(JSON.stringify(data)));

    this.successMsg = 'OTP verified! Redirecting...';
    setTimeout(() => {
      this.router.navigate(['/reset-password'], {
        queryParams: { email: this.email },
      });
    }, 900);
  }

  async resendOtp() {
    if (this.resendCooldown > 0) return;
    this.errorMsg = '';
    this.successMsg = '';
    this.loading = true;

    try {
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 10 * 60 * 1000;

      let emailSent = false;
      try {
        await lastValueFrom(
          this.http.post('/api/send-otp', { email: this.email, otp: newOtp }),
        );
        emailSent = true;
      } catch {
        console.warn('[VerifyOtp] Email API unavailable — dev mode resend');
      }

      const otpData = {
        otp: newOtp,
        email: this.email,
        expires,
        attempts: 0,
        devMode: !emailSent,
      };
      sessionStorage.setItem('alh_otp_data', btoa(JSON.stringify(otpData)));

      this.devOtp = !emailSent ? newOtp : '';
      this.digits = ['', '', '', '', '', ''];
      this.expired = false;
      this.timeLeft = 600;
      this.startTimer();

      this.successMsg = emailSent
        ? 'New OTP sent to your email.'
        : 'New OTP generated (shown below — email unavailable in dev mode).';

      // 60-second resend cooldown
      this.resendCooldown = 60;
      if (this.resendTimerInterval) clearInterval(this.resendTimerInterval);
      this.resendTimerInterval = setInterval(() => {
        this.resendCooldown = Math.max(0, this.resendCooldown - 1);
        if (this.resendCooldown === 0) clearInterval(this.resendTimerInterval!);
      }, 1000);

      setTimeout(() => (document.getElementById('otp-0') as HTMLInputElement)?.focus(), 100);
    } catch {
      this.errorMsg = 'Could not resend OTP. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
