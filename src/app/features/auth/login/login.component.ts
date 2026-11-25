import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  email    = '';
  password = '';
  errorMsg = '';
  loading = false;

  /** Where to go after login — from ?redirect= query param */
  redirectUrl = '/';

  constructor(
    private auth:  AuthService,
    private router: Router,
    private route:  ActivatedRoute
  ) {
    // Validate redirect — must be a local path starting with /
    this.route.queryParams.subscribe(p => {
      const raw = p['redirect'];
      if (raw && typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) {
        this.redirectUrl = raw;
      }
    });

    // Already logged in? Go straight to the destination
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl(this.redirectUrl);
    }
  }

  async login() {
    if (this.loading) return;
    this.errorMsg = '';

    if (!this.email || !this.password) {
      this.errorMsg = 'Please fill in all fields.';
      return;
    }

    this.loading = true;
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl(this.redirectUrl);
    } catch (error: any) { this.errorMsg = error.error?.error || 'Could not sign in. Please try again.'; }
    finally { this.loading = false; }
  }
}
