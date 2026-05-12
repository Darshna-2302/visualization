import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VegaChart } from './vega-chart';

describe('VegaChart', () => {
  let component: VegaChart;
  let fixture: ComponentFixture<VegaChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VegaChart],
    }).compileComponents();

    fixture = TestBed.createComponent(VegaChart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
