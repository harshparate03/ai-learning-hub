import { Injectable } from '@angular/core';

const PREFIX = 'alh_';
const MAX_ITEM_BYTES = 4_500_000;

@Injectable({ providedIn: 'root' })
export class StorageService {

  getItem<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  setItem(key: string, value: unknown): boolean {
    try {
      const serialized = JSON.stringify(value);
      if (serialized.length > MAX_ITEM_BYTES) {
        console.warn(`[Storage] Item "${key}" exceeds safe size limit`);
        return false;
      }
      localStorage.setItem(PREFIX + key, serialized);
      return true;
    } catch {
      return false;
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch { /* ignore */ }
  }

  getString(key: string): string {
    try {
      return localStorage.getItem(PREFIX + key) || '';
    } catch {
      return '';
    }
  }

  setString(key: string, value: string): void {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch { /* ignore */ }
  }
}
