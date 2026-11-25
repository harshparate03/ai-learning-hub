/** Corrupted or outdated browser data must not prevent a study page loading. */
export function readStoredArray<T = any>(key: string): T[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as T[] : [];
  } catch { return []; }
}
