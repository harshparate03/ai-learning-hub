import { Component, OnDestroy } from '@angular/core';
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

  isMenuOpen = false;
  isChatOpen = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    public theme: ThemeService
  ) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.closeMenu());
  }

  get isLoggedIn(): boolean { return this.auth.isLoggedIn(); }
  get currentUser(): string { return this.auth.getCurrentUser(); }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
    document.body.style.overflow = this.isMenuOpen ? 'hidden' : '';
  }

  closeMenu() {
    this.isMenuOpen = false;
    document.body.style.overflow = '';
  }

  openChat() {
    this.isChatOpen = true;
    this.closeMenu();
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }
}
