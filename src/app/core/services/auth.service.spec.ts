import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { httpTestProviders } from '../../testing/common-test-providers';
import { HttpTestingController } from '@angular/common/http/testing';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...httpTestProviders] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); localStorage.removeItem('alh_loggedIn'); });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('ignores forged browser login flags', async () => {
    localStorage.setItem('alh_loggedIn', 'true');
    expect(service.isLoggedIn()).toBeFalse();
    const refresh = service.refreshSession();
    http.expectOne('/api/auth').flush({ email: '' });
    expect(await refresh).toBeFalse();
  });

  it('restores only the server-authenticated account', async () => {
    const refresh = service.refreshSession();
    http.expectOne('/api/auth').flush({ email: 'student@example.com' });
    expect(await refresh).toBeTrue();
    expect(service.getCurrentUser()).toBe('student@example.com');
  });

  it('clears a session when the server cannot verify it', async () => {
    const refresh = service.refreshSession();
    http.expectOne('/api/auth').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(await refresh).toBeFalse();
  });
});
