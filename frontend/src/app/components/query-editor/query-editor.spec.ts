import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueryEditor } from './query-editor';

describe('QueryEditor', () => {
  let component: QueryEditor;
  let fixture: ComponentFixture<QueryEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(QueryEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
