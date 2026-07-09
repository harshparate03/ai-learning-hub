import { EnvironmentProviders, Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

type TestProvider = Provider | EnvironmentProviders;

/** Router + HTTP deps used by most standalone component specs. */
export const commonTestProviders: TestProvider[] = [
  provideRouter([]),
  provideHttpClient(),
  provideHttpClientTesting(),
];

/** HTTP-only deps for service specs. */
export const httpTestProviders: TestProvider[] = [
  provideHttpClient(),
  provideHttpClientTesting(),
];
