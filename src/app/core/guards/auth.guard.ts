import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (await auth.refreshSession()) return true;

  // Save the URL the user tried to access so we can redirect back after login
  const redirect = state.url;
  return router.createUrlTree(['/login'], {
    queryParams: redirect && redirect !== '/' ? { redirect } : {}
  });
};
