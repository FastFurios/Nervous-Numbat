import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Statistics } from './statistics';

describe('Statistics', () => {
  let component: Statistics;
  let fixture: ComponentFixture<Statistics>;

  beforeEach(async () => {
    // jsdom has no canvas implementation: hand out a 2D context whose every method is a no-op
    const noOpCtx = new Proxy({}, { get: () => () => {}, set: () => true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(noOpCtx as unknown as CanvasRenderingContext2D);
    await TestBed.configureTestingModule({
      imports: [Statistics]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Statistics);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('clock', signal(0));
    fixture.componentRef.setInput('widgetWidth', signal(30));
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
