import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultsPopUp } from './results-pop-up';

describe('ResultsPopUp', () => {
  let component: ResultsPopUp;
  let fixture: ComponentFixture<ResultsPopUp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultsPopUp],
    }).compileComponents();

    fixture = TestBed.createComponent(ResultsPopUp);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
