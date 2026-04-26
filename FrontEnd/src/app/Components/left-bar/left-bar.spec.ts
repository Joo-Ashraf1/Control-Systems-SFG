import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeftBar } from './left-bar';

describe('LeftBar', () => {
  let component: LeftBar;
  let fixture: ComponentFixture<LeftBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeftBar],
    }).compileComponents();

    fixture = TestBed.createComponent(LeftBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
