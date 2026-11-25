import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OtpStore } from '../../../core/services/otp.service';
import { isValidEmail, sanitizeEmail } from '../../../core/utils/sanitize.util';
@Component({
  selector: 'app-forgot-password', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html', styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  email = ''; loading = false; errorMsg = ''; successMsg = '';
  constructor(private router: Router, private http: HttpClient) {}
  async onSubmit() {
    if (this.loading) return;
    this.errorMsg = ''; this.successMsg = '';
    const email = sanitizeEmail(this.email);
    if (!isValidEmail(email)) { this.errorMsg = 'Please enter a valid email address.'; return; }
    this.loading = true;
    try {
      const result = await firstValueFrom(this.http.post<{ expires: number }>('/api/auth', { action: 'send-otp', email }));
      OtpStore.save({ email, expires: result.expires });
      await this.router.navigate(['/verify-otp'], { queryParams: { email } });
    } catch (error: any) { this.errorMsg = error.error?.error || 'Could not send the reset code. Please try again later.'; }
    finally { this.loading = false; }
  }
}
