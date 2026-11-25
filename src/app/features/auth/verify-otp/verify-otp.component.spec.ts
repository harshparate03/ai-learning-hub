import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { VerifyOtpComponent } from './verify-otp.component';
import { commonTestProviders } from '../../../testing/common-test-providers';
import { OtpStore } from '../../../core/services/otp.service';

describe('VerifyOtpComponent', () => {
  let component: VerifyOtpComponent;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...commonTestProviders,
      { provide: ActivatedRoute, useValue: { snapshot: { queryParams: { email: 'student@example.com' } } } }
    ] });
    component = new VerifyOtpComponent(TestBed.inject(Router), TestBed.inject(ActivatedRoute), TestBed.inject(HttpClient));
    http = TestBed.inject(HttpTestingController);
    OtpStore.save({ email: 'student@example.com', expires: Date.now() + 600000 });
    component.ngOnInit();
  });
  afterEach(() => { component.ngOnDestroy(); OtpStore.clear(); http.verify(); });
  it('allows verification after a successful resend notification', async () => {
    const resend = component.resendOtp();
    http.expectOne('/api/auth').flush({ expires: Date.now() + 600000 });
    await resend;
    expect(component.successMsg).toContain('new code');
    expect(component.verified).toBeFalse();
    component.digits = ['1', '2', '3', '4', '5', '6'];
    const verify = component.onVerify();
    const request = http.expectOne('/api/auth');
    expect(request.request.body.action).toBe('verify-otp');
    request.flush({ error: 'Incorrect code' }, { status: 400, statusText: 'Bad Request' });
    await verify;
    expect(component.errorMsg).toBe('Incorrect code');
  });
  it('does not replace UI state or claim success on failed delivery', async () => {
    const existing = OtpStore.load();
    const resend = component.resendOtp();
    http.expectOne('/api/auth').flush({ error: 'Delivery unavailable' }, { status: 503, statusText: 'Unavailable' });
    await resend;
    expect(OtpStore.load()).toEqual(existing);
    expect(component.successMsg).toBe('');
    expect(component.errorMsg).toBe('Delivery unavailable');
  });
});
