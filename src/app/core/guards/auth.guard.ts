import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  // Save the URL the user tried to access so we can redirect back after login
  const redirect = state.url;
  router.navigate(['/login'], {
    queryParams: redirect && redirect !== '/' ? { redirect } : {}
  });
  return false;
};
