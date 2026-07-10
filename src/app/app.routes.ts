import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { GenerateComponent } from './features/mindmap/generate/generate.component';
import { SavedComponent } from './features/mindmap/saved/saved.component';
import { SearchComponent } from './features/youtube-ai/search/search.component';
import { UploadComponent } from './features/summarizer/upload/upload.component';
import { HistoryComponent } from './features/summarizer/history/history.component';
import { ChatPdfComponent } from './features/summarizer/chat-pdf/chat-pdf.component';
import { LoginComponent } from './features/auth/login/login.component';
import { SignupComponent } from './features/auth/signup/signup.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';
import { VerifyOtpComponent } from './features/auth/verify-otp/verify-otp.component';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';
import { NotFoundComponent } from './features/not-found/not-found.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ── Public routes (no auth required) ─────────────────
  { path: '',               component: HomeComponent },   // Home is PUBLIC
  { path: 'login',          component: LoginComponent },
  { path: 'signup',         component: SignupComponent },
  { path: 'forgot-password',component: ForgotPasswordComponent },
  { path: 'verify-otp',     component: VerifyOtpComponent },
  { path: 'reset-password', component: ResetPasswordComponent },

  // ── Protected feature routes ──────────────────────────
  { path: 'mindmap',           component: GenerateComponent, canActivate: [authGuard] },
  { path: 'mindmap/saved',     component: SavedComponent,    canActivate: [authGuard] },

  { path: 'youtube',           component: SearchComponent,   canActivate: [authGuard] },
  { path: 'youtube/summary',   redirectTo: '/youtube',            pathMatch: 'full' },
  { path: 'youtube/notes',     redirectTo: '/youtube',            pathMatch: 'full' },

  { path: 'summarizer/upload', component: UploadComponent,   canActivate: [authGuard] },
  { path: 'summarizer/chat',   component: ChatPdfComponent,  canActivate: [authGuard] },
  { path: 'summarizer/summary',redirectTo: '/summarizer/upload',  pathMatch: 'full' },
  { path: 'summarizer/qa',     redirectTo: '/summarizer/upload',  pathMatch: 'full' },

  { path: 'history',           component: HistoryComponent,  canActivate: [authGuard] },

  // ── 404 ───────────────────────────────────────────────
  { path: '**', component: NotFoundComponent },
];
