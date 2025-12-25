import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainCanvas } from './main-canvas';

describe('MainCanvas', () => {
  let component: MainCanvas;
  let fixture: ComponentFixture<MainCanvas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainCanvas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainCanvas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
