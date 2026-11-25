import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ── Public routes (no auth required) ─────────────────
  { path: '',               component: HomeComponent },   // Home is PUBLIC
  { path: 'login',          loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'signup',         loadComponent: () => import('./features/auth/signup/signup.component').then(m => m.SignupComponent) },
  { path: 'forgot-password',  loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
  { path: 'verify-otp',      loadComponent: () => import('./features/auth/verify-otp/verify-otp.component').then(m => m.VerifyOtpComponent) },
  { path: 'reset-password',  loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },

  // ── Protected feature routes ──────────────────────────
  { path: 'change-password', loadComponent: () => import('./features/auth/change-password/change-password.component').then(m => m.ChangePasswordComponent), canActivate: [authGuard] },
  { path: 'mindmap',           loadComponent: () => import('./features/mindmap/generate/generate.component').then(m => m.GenerateComponent), canActivate: [authGuard] },
  { path: 'mindmap/saved',     loadComponent: () => import('./features/mindmap/saved/saved.component').then(m => m.SavedComponent),    canActivate: [authGuard] },

  { path: 'youtube',           loadComponent: () => import('./features/youtube-ai/search/search.component').then(m => m.SearchComponent),   canActivate: [authGuard] },
  { path: 'youtube/summary',   redirectTo: '/youtube',            pathMatch: 'full' },
  { path: 'youtube/notes',     redirectTo: '/youtube',            pathMatch: 'full' },

  { path: 'summarizer/upload', loadComponent: () => import('./features/summarizer/upload/upload.component').then(m => m.UploadComponent),   canActivate: [authGuard] },
  { path: 'summarizer/chat',   loadComponent: () => import('./features/summarizer/chat-pdf/chat-pdf.component').then(m => m.ChatPdfComponent),  canActivate: [authGuard] },
  { path: 'summarizer/summary',redirectTo: '/summarizer/upload',  pathMatch: 'full' },
  { path: 'summarizer/qa',     redirectTo: '/summarizer/upload',  pathMatch: 'full' },

  { path: 'history',           loadComponent: () => import('./features/summarizer/history/history.component').then(m => m.HistoryComponent),  canActivate: [authGuard] },

  // ── 404 ───────────────────────────────────────────────
  { path: '**', loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent) },
];
