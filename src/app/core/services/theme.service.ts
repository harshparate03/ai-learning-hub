import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  private isDark = true;

  constructor() {
    const saved = localStorage.getItem('theme');
    this.isDark = saved ? saved === 'dark' : true;
    this.applyTheme();
  }

  get darkMode(): boolean {
    return this.isDark;
  }

  toggle() {
    this.isDark = !this.isDark;
    localStorage.setItem('theme', this.isDark ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme() {
    document.body.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
  }
}
