import { Injectable } from '@angular/core';
import { sanitizeEmail, isValidEmail, sanitizeUserInput } from '../utils/sanitize.util';

/** Session length in milliseconds — 7 days */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LEN = 6;
const MAX_PASSWORD_LEN = 128;

@Injectable({ providedIn: 'root' })
export class AuthService {

  // ── Simple deterministic hash (no crypto API needed in browser) ──────────
  // Uses djb2 — not cryptographic but far better than plain text for localStorage
  private hash(value: string): string {
    let h = 5381;
    for (let i = 0; i < value.length; i++) {
      h = ((h << 5) + h) ^ value.charCodeAt(i);
      h = h >>> 0; // keep unsigned 32-bit
    }
    return h.toString(16);
  }

  private getUsers(): { email: string; passwordHash: string }[] {
    try {
      return JSON.parse(localStorage.getItem('alh_users') || '[]');
    } catch {
      return [];
    }
  }

  private saveUsers(users: { email: string; passwordHash: string }[]) {
    localStorage.setItem('alh_users', JSON.stringify(users));
  }

  // ── Auth actions ──────────────────────────────────────────────────────────

  /** Check if an email is already registered (used for better error messages in signup) */
  isEmailTaken(email: string): boolean {
    const emailLower = sanitizeEmail(email);
    return this.getUsers().some(u => u.email === emailLower);
  }

  signup(email: string, password: string): boolean {
    const emailLower = sanitizeEmail(email);
    const safePassword = sanitizeUserInput(password, MAX_PASSWORD_LEN);
    if (!isValidEmail(emailLower) || safePassword.length < MIN_PASSWORD_LEN) return false;

    const users = this.getUsers();
    if (users.find(u => u.email === emailLower)) return false;
    users.push({ email: emailLower, passwordHash: this.hash(safePassword) });
    this.saveUsers(users);
    return true;
  }

  login(email: string, password: string): boolean {
    const emailLower = sanitizeEmail(email);
    const safePassword = sanitizeUserInput(password, MAX_PASSWORD_LEN);
    if (!isValidEmail(emailLower) || !safePassword) return false;

    const users = this.getUsers();
    const found = users.find(
      u => u.email === emailLower && u.passwordHash === this.hash(safePassword)
    );
    if (found) {
      const expiresAt = Date.now() + SESSION_TTL_MS;
      localStorage.setItem('alh_loggedIn', 'true');
      localStorage.setItem('alh_currentUser', emailLower);
      localStorage.setItem('alh_sessionExpires', String(expiresAt));
      return true;
    }
    return false;
  }

  isLoggedIn(): boolean {
    if (localStorage.getItem('alh_loggedIn') !== 'true') return false;
    // Check session expiry
    const expires = Number(localStorage.getItem('alh_sessionExpires') || '0');
    if (Date.now() > expires) {
      this.logout(); // auto-clear expired session
      return false;
    }
    return true;
  }

  getCurrentUser(): string {
    return localStorage.getItem('alh_currentUser') || '';
  }

  logout() {
    localStorage.removeItem('alh_loggedIn');
    localStorage.removeItem('alh_currentUser');
    localStorage.removeItem('alh_sessionExpires');
  }

  /** Migrate legacy plain-text sessions from previous auth implementation */
  migrateLegacySessions() {
    const legacy = localStorage.getItem('loggedIn');
    if (legacy === 'true') {
      const legacyUser = localStorage.getItem('currentUser') || '';
      const legacyUsers: { email: string; password: string }[] =
        JSON.parse(localStorage.getItem('users') || '[]');

      // Re-hash any existing plain-text users
      const newUsers = legacyUsers.map(u => ({
        email: u.email.toLowerCase(),
        passwordHash: this.hash(u.password)
      }));
      if (newUsers.length) this.saveUsers(newUsers);

      // Migrate active session
      if (legacyUser) {
        const expiresAt = Date.now() + SESSION_TTL_MS;
        localStorage.setItem('alh_loggedIn', 'true');
        localStorage.setItem('alh_currentUser', legacyUser.toLowerCase());
        localStorage.setItem('alh_sessionExpires', String(expiresAt));
      }

      // Remove old keys
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('users');
    }
  }
}
