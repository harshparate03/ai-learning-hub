import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css',
})
export class ChangePasswordComponent {
  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';
  loading         = false;
  errorMsg        = '';
  successMsg      = '';
  showCurrent     = false;
  showNew         = false;
  showConfirm     = false;

  readonly currentEmail: string;

  constructor(private auth: AuthService, private router: Router) {
    // Must be logged in
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
    }
    this.currentEmail = this.auth.getCurrentUser();
  }

  get passwordStrength(): { label: string; level: number; color: string } {
    const p = this.newPassword;
    if (!p) return { label: '', level: 0, color: '' };
    let score = 0;
    if (p.length >= 8)          score++;
    if (p.length >= 12)         score++;
    if (/[A-Z]/.test(p))        score++;
    if (/[0-9]/.test(p))        score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { label: 'Weak',        level: 1, color: '#ef4444' };
    if (score <= 2) return { label: 'Fair',        level: 2, color: '#f97316' };
    if (score <= 3) return { label: 'Good',        level: 3, color: '#eab308' };
    if (score <= 4) return { label: 'Strong',      level: 4, color: '#22c55e' };
    return                       { label: 'Very Strong', level: 5, color: '#10b981' };
  }

  onSubmit() {
    this.errorMsg  = '';
    this.successMsg = '';

    if (!this.currentPassword) {
      this.errorMsg = 'Please enter your current password.';
      return;
    }
    if (!this.newPassword || !this.confirmPassword) {
      this.errorMsg = 'Please fill in all fields.';
      return;
    }
    if (this.newPassword.length < 6) {
      this.errorMsg = 'New password must be at least 6 characters.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMsg = 'New passwords do not match.';
      return;
    }
    if (this.currentPassword === this.newPassword) {
      this.errorMsg = 'New password must be different from the current one.';
      return;
    }

    this.loading = true;

    // Verify current password by attempting a login check
    const currentOk = this.auth.verifyPassword(this.currentEmail, this.currentPassword);
    if (!currentOk) {
      this.errorMsg = 'Current password is incorrect.';
      this.loading  = false;
      return;
    }

    const ok = this.auth.resetPassword(this.currentEmail, this.newPassword);
    this.loading = false;

    if (ok) {
      this.successMsg = 'Password changed successfully!';
      this.currentPassword = '';
      this.newPassword     = '';
      this.confirmPassword = '';
      setTimeout(() => this.router.navigate(['/']), 1800);
    } else {
      this.errorMsg = 'Could not update password. Please try again.';
    }
  }
}
