import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private email = '';
  constructor(private http: HttpClient) {}
  isLoggedIn(): boolean { return !!this.email; }
  getCurrentUser(): string { return this.email; }
  async refreshSession(): Promise<boolean> {
    try {
      const result = await firstValueFrom(this.http.get<{ email: string }>('/api/auth'));
      this.email = result.email || '';
    } catch { this.email = ''; }
    return this.isLoggedIn();
  }
  async signup(email: string, password: string): Promise<void> { await this.authenticate('signup', { email, password }); }
  async login(email: string, password: string): Promise<void> { await this.authenticate('login', { email, password }); }
  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth', { action: 'logout' }));
    this.email = '';
  }
  async resetPassword(email: string, password: string, token: string): Promise<void> {
    await this.authenticate('reset-password', { email, password, token });
  }
  async changePassword(currentPassword: string, password: string): Promise<void> {
    await this.authenticate('change-password', { email: this.email, currentPassword, password });
  }
  private async authenticate(action: string, body: object): Promise<void> {
    const result = await firstValueFrom(this.http.post<{ email: string }>('/api/auth', { ...body, action }));
    this.email = result.email;
  }
  migrateLegacySessions(): void {
    // Untrusted browser accounts cannot prove ownership to the server.
    for (const key of ['alh_users', 'alh_loggedIn', 'alh_currentUser', 'alh_sessionExpires', 'users', 'loggedIn', 'currentUser']) localStorage.removeItem(key);
    sessionStorage.removeItem('alh_otp_data');
  }
}
