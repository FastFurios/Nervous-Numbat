import { TestBed } from '@angular/core/testing';

import { System } from './system';

describe('System', () => {
  let service: System;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(System);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
