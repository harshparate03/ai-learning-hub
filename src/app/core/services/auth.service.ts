import { Injectable } from '@angular/core';
import { sanitizeEmail, isValidEmail, sanitizeUserInput } from '../utils/sanitize.util';

/**
 * Session TTL = 30 days (persistent login — user stays logged in until they
 * explicitly click Logout or their session expires after 30 days of inactivity).
 */
const SESSION_TTL_MS    = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_REFRESH_MS =  1 * 24 * 60 * 60 * 1000; // refresh expiry if active within 1 day
const MIN_PASSWORD_LEN  = 6;
const MAX_PASSWORD_LEN  = 128;

const KEYS = {
  users:          'alh_users',
  loggedIn:       'alh_loggedIn',
  currentUser:    'alh_currentUser',
  sessionExpires: 'alh_sessionExpires',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthService {

  // ── djb2 hash (non-cryptographic, used only because there is no server) ──
  private hash(value: string): string {
    let h = 5381;
    for (let i = 0; i < value.length; i++) {
      h = ((h << 5) + h) ^ value.charCodeAt(i);
      h = h >>> 0;
    }
    return h.toString(16);
  }

  // ── User store ────────────────────────────────────────────────────────────

  private getUsers(): { email: string; passwordHash: string }[] {
    try { return JSON.parse(localStorage.getItem(KEYS.users) || '[]'); }
    catch { return []; }
  }

  private saveUsers(users: { email: string; passwordHash: string }[]) {
    localStorage.setItem(KEYS.users, JSON.stringify(users));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  isEmailTaken(email: string): boolean {
    return this.getUsers().some(u => u.email === sanitizeEmail(email));
  }

  signup(email: string, password: string): boolean {
    const emailLower  = sanitizeEmail(email);
    const safePass    = sanitizeUserInput(password, MAX_PASSWORD_LEN);
    if (!isValidEmail(emailLower) || safePass.length < MIN_PASSWORD_LEN) return false;

    const users = this.getUsers();
    if (users.find(u => u.email === emailLower)) return false;

    users.push({ email: emailLower, passwordHash: this.hash(safePass) });
    this.saveUsers(users);
    return true;
  }

  login(email: string, password: string): boolean {
    const emailLower = sanitizeEmail(email);
    const safePass   = sanitizeUserInput(password, MAX_PASSWORD_LEN);
    if (!isValidEmail(emailLower) || !safePass) return false;

    const found = this.getUsers().find(
      u => u.email === emailLower && u.passwordHash === this.hash(safePass)
    );
    if (!found) return false;

    this.persistSession(emailLower);
    return true;
  }

  /**
   * Check if the user is currently logged in.
   *
   * Rules:
   * - Returns true  when alh_loggedIn === 'true' AND session has NOT expired.
   * - Returns false when the key is missing or session is expired (auto-clears).
   * - Silently extends the expiry window by SESSION_TTL_MS on every valid check
   *   (rolling session — user stays logged in as long as they use the site).
   */
  isLoggedIn(): boolean {
    if (localStorage.getItem(KEYS.loggedIn) !== 'true') return false;

    const raw     = localStorage.getItem(KEYS.sessionExpires);
    const expires = raw ? Number(raw) : null;

    // If expiry is missing (old session stored without TTL), treat as valid and add TTL now
    if (expires === null || isNaN(expires)) {
      this.refreshSession();
      return true;
    }

    if (Date.now() > expires) {
      this.logout(); // genuinely expired — clear it
      return false;
    }

    // Rolling window: if the expiry is coming up within SESSION_REFRESH_MS, extend it
    if (expires - Date.now() < SESSION_REFRESH_MS) {
      this.refreshSession();
    }

    return true;
  }

  getCurrentUser(): string {
    return localStorage.getItem(KEYS.currentUser) || '';
  }

  logout() {
    localStorage.removeItem(KEYS.loggedIn);
    localStorage.removeItem(KEYS.currentUser);
    localStorage.removeItem(KEYS.sessionExpires);
  }

  /**
   * Reset a user's password after OTP verification.
   * Finds the account by email and overwrites the stored password hash.
   */
  resetPassword(email: string, newPassword: string): boolean {
    const emailLower = sanitizeEmail(email);
    const safePass   = sanitizeUserInput(newPassword, MAX_PASSWORD_LEN);
    if (!isValidEmail(emailLower) || safePass.length < MIN_PASSWORD_LEN) return false;

    const users = this.getUsers();
    const user  = users.find(u => u.email === emailLower);
    if (!user) return false;

    user.passwordHash = this.hash(safePass);
    this.saveUsers(users);
    return true;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Write / overwrite session keys */
  private persistSession(email: string) {
    const expiresAt = Date.now() + SESSION_TTL_MS;
    localStorage.setItem(KEYS.loggedIn,       'true');
    localStorage.setItem(KEYS.currentUser,    email);
    localStorage.setItem(KEYS.sessionExpires, String(expiresAt));
  }

  /** Extend the expiry of an already-valid session */
  private refreshSession() {
    const email = this.getCurrentUser();
    if (email) this.persistSession(email);
    else localStorage.setItem(KEYS.sessionExpires, String(Date.now() + SESSION_TTL_MS));
  }

  /**
   * One-time migration from the old key names / plain-text passwords.
   * Called once on app start from AppComponent.
   */
  migrateLegacySessions() {
    // Old keys from the very first implementation
    const legacy = localStorage.getItem('loggedIn');
    if (legacy === 'true') {
      const legacyUser  = localStorage.getItem('currentUser') || '';
      const legacyUsers: { email: string; password: string }[] =
        JSON.parse(localStorage.getItem('users') || '[]');

      // Re-hash plain-text passwords
      const newUsers = legacyUsers.map(u => ({
        email: u.email.toLowerCase(),
        passwordHash: this.hash(u.password)
      }));
      if (newUsers.length) this.saveUsers(newUsers);

      // Migrate active session
      if (legacyUser) this.persistSession(legacyUser.toLowerCase());

      // Remove old keys
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('users');
    }

    // Fix sessions that have alh_loggedIn = 'true' but are missing the expiry timestamp
    // (from versions before TTL was introduced)
    if (
      localStorage.getItem(KEYS.loggedIn) === 'true' &&
      !localStorage.getItem(KEYS.sessionExpires)
    ) {
      this.refreshSession();
    }
  }
}
