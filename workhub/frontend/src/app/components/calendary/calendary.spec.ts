import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Calendary } from './calendary';

describe('Calendary', () => {
  let component: Calendary;
  let fixture: ComponentFixture<Calendary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Calendary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Calendary);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
