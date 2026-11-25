/** UI state only. OTPs and verification are checked by the server. */
export interface OtpSession { email: string; expires: number; token?: string; }
const KEY = 'alh_reset_state';
export const OtpStore = {
  save(data: OtpSession): void { sessionStorage.setItem(KEY, JSON.stringify(data)); },
  load(): OtpSession | null {
    try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
  },
  clear(): void { sessionStorage.removeItem(KEY); }
};
