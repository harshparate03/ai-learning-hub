import { Component, OnDestroy, HostListener } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule, SlicePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ChatbotComponent } from '../chatbot/chatbot.component';
import { LogoComponent } from '../logo/logo.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, SlicePipe, ChatbotComponent, LogoComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnDestroy {

  isMenuOpen     = false;
  isUserMenuOpen = false;
  isChatOpen     = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    public theme: ThemeService
  ) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.closeMenu();
      this.closeUserMenu();
    });
  }

  get isLoggedIn(): boolean  { return this.auth.isLoggedIn(); }
  get currentUser(): string  { return this.auth.getCurrentUser(); }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
    if (this.isMenuOpen) this.isUserMenuOpen = false;
    document.body.style.overflow = this.isMenuOpen ? 'hidden' : '';
  }

  closeMenu() {
    this.isMenuOpen = false;
    document.body.style.overflow = '';
  }

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu() {
    this.isUserMenuOpen = false;
  }

  /** Close user dropdown when clicking outside */
  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-chip') && !target.closest('.user-dropdown')) {
      this.isUserMenuOpen = false;
    }
  }

  openChat() {
    this.isChatOpen = true;
    this.closeMenu();
  }

  logout() {
    this.isUserMenuOpen = false;
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }
}
