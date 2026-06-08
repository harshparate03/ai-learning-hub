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

  /** Where to go after login — from ?redirect= query param */
  redirectUrl = '/';

  constructor(
    private auth:  AuthService,
    private router: Router,
    private route:  ActivatedRoute
  ) {
    // If the guard saved a redirect URL, read it
    this.route.queryParams.subscribe(p => {
      if (p['redirect']) this.redirectUrl = p['redirect'];
    });

    // Already logged in? Go straight to the destination
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl(this.redirectUrl);
    }
  }

  login() {
    this.errorMsg = '';

    if (!this.email || !this.password) {
      this.errorMsg = 'Please fill in all fields.';
      return;
    }

    const success = this.auth.login(this.email, this.password);
    if (success) {
      // Navigate to the feature they originally tried to access
      this.router.navigateByUrl(this.redirectUrl);
    } else {
      this.errorMsg = 'Invalid email or password.';
    }
  }
}
