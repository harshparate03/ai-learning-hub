import { TestBed } from '@angular/core/testing';

import { AiService } from './ai.service';
import { httpTestProviders } from '../../testing/common-test-providers';

describe('AiService', () => {
  let service: AiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...httpTestProviders],
    });
    service = TestBed.inject(AiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
