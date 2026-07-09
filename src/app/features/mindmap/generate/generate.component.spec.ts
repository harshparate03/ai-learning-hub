import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerateComponent } from './generate.component';
import { commonTestProviders } from '../../../testing/common-test-providers';

describe('GenerateComponent', () => {
  let component: GenerateComponent;
  let fixture: ComponentFixture<GenerateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerateComponent],
      providers: [...commonTestProviders],
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenerateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
