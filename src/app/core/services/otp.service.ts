/**
 * OTP session utility — safe encode/decode using UTF-8 base64
 * (plain btoa() breaks on characters outside Latin-1, e.g. Unicode emails).
 */
export interface OtpSession {
  otp: string;
  email: string;
  expires: number;
  attempts: number;
  verified?: boolean;
}

const KEY = 'alh_otp_data';

/** Encode → UTF-8 safe base64 */
function encode(data: OtpSession): string {
  const json = JSON.stringify(data);
  return btoa(unescape(encodeURIComponent(json)));
}

/** Decode ← UTF-8 safe base64 */
function decode(raw: string): OtpSession {
  return JSON.parse(decodeURIComponent(escape(atob(raw))));
}

export const OtpStore = {
  save(data: OtpSession): void {
    sessionStorage.setItem(KEY, encode(data));
  },

  load(): OtpSession | null {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    try { return decode(raw); } catch { return null; }
  },

  update(patch: Partial<OtpSession>): void {
    const current = OtpStore.load();
    if (current) OtpStore.save({ ...current, ...patch });
  },

  clear(): void {
    sessionStorage.removeItem(KEY);
  },
};
