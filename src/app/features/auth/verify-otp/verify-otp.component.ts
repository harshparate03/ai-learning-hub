import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OtpStore } from '../../../core/services/otp.service';
@Component({
  selector: 'app-verify-otp', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './verify-otp.component.html', styleUrl: './verify-otp.component.css'
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  email = ''; digits = ['', '', '', '', '', '']; loading = false;
  errorMsg = ''; successMsg = ''; verified = false;
  timeLeft = 600; resendCooldown = 0; expired = false;
  private expires = 0;
  private cooldownUntil = 0;
  private timer?: ReturnType<typeof setInterval>;
  constructor(private router: Router, private route: ActivatedRoute, private http: HttpClient) {}
  ngOnInit() {
    this.email = this.route.snapshot.queryParams['email'] || '';
    const session = OtpStore.load();
    if (!session || session.email !== this.email) { void this.router.navigate(['/forgot-password']); return; }
    this.expires = session.expires;
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }
  private tick() {
    this.timeLeft = Math.max(0, Math.ceil((this.expires - Date.now()) / 1000));
    this.resendCooldown = Math.max(0, Math.ceil((this.cooldownUntil - Date.now()) / 1000));
    this.expired = this.timeLeft === 0;
  }
  formatTime(seconds: number): string { return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`; }
  onDigitInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    this.digits[index] = input.value.replace(/\D/g, '').slice(-1); input.value = this.digits[index];
    if (input.value && index < 5) this.focusBox(index + 1);
    if (this.digits.join('').length === 6) void this.onVerify();
  }
  onKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) { this.digits[index - 1] = ''; this.focusBox(index - 1); }
  }
  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || '';
    this.digits = Array.from({ length: 6 }, (_, i) => text[i] || ''); this.focusBox(Math.min(text.length, 5));
    if (text.length === 6) void this.onVerify();
  }
  private focusBox(index: number) { document.getElementById(`otp-${index}`)?.focus(); }
  async onVerify() {
    if (this.loading || this.expired || this.verified || this.digits.join('').length !== 6) return;
    this.loading = true; this.errorMsg = ''; this.successMsg = '';
    try {
      const result = await firstValueFrom(this.http.post<{ token: string; expires: number }>('/api/auth', { action: 'verify-otp', email: this.email, otp: this.digits.join('') }));
      OtpStore.save({ email: this.email, token: result.token, expires: result.expires }); this.verified = true;
      await this.router.navigate(['/reset-password'], { queryParams: { email: this.email } });
    } catch (error: any) {
      this.errorMsg = error.error?.error || 'Could not verify the code. Please try again.';
      this.digits = ['', '', '', '', '', '']; this.focusBox(0);
    } finally { this.loading = false; }
  }
  async resendOtp() {
    if (this.loading || this.resendCooldown > 0 || this.verified) return;
    this.loading = true; this.errorMsg = ''; this.successMsg = '';
    try {
      const result = await firstValueFrom(this.http.post<{ expires: number }>('/api/auth', { action: 'send-otp', email: this.email }));
      this.expires = result.expires; this.cooldownUntil = Date.now() + 60000;
      OtpStore.save({ email: this.email, expires: result.expires }); this.digits = ['', '', '', '', '', ''];
      this.successMsg = 'If this email has an account, a new code has been sent.'; this.tick();
    } catch (error: any) { this.errorMsg = error.error?.error || 'Could not resend the code. Please try again.'; }
    finally { this.loading = false; }
  }
}
