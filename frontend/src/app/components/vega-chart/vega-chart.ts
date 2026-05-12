import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnChanges, AfterViewInit, ChangeDetectionStrategy, SimpleChanges, ViewChild, OnDestroy, NgZone } from '@angular/core';
import embed from 'vega-embed';

@Component({
  selector: 'app-vega-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vega-chart.html',
  styleUrls: ['./vega-chart.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VegaChart implements OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  @Input() data: any[] = [];
  @Input() chartType: string = 'bar';
  @Input() xAxis: string = '';
  @Input() yAxis: string = '';
  @Input() groupBy: string = '';
  @Input() title: string = '';
  @Input() metric: string = 'count';
  @Input() metricColumn: string = '';

  private view: any = null;
  private isRendering: boolean = false;
  private renderTimeout: any = null;
  
  constructor(private ngZone: NgZone) {}

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.renderChart();
      }, 100);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('ngOnChanges detected:', Object.keys(changes));
    
    // Clear any pending render
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    
    // Destroy existing view if chart type changed
    if (changes['chartType'] && this.view) {
      console.log('Chart type changed from', changes['chartType'].previousValue, 'to', changes['chartType'].currentValue);
      try {
        this.view.destroy();
        this.view = null;
      } catch(e) {}
    }
    
    // Schedule a re-render
    this.ngZone.runOutsideAngular(() => {
      this.renderTimeout = setTimeout(() => {
        this.renderChart();
      }, 150);
    });
  }

  ngOnDestroy() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    if (this.view) {
      try {
        this.view.destroy();
      } catch(e) {}
      this.view = null;
    }
  }

  private async renderChart() {
    console.log('renderChart called - chartType:', this.chartType, 'data length:', this.data?.length);
    
    if (!this.chartContainer || !this.chartContainer.nativeElement) {
      console.log('Chart container not ready');
      return;
    }
    
    if (!this.data || this.data.length === 0) {
      console.log('No data to render');
      if (this.chartContainer.nativeElement) {
        this.chartContainer.nativeElement.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;">No data available for chart</div>';
      }
      return;
    }
    
    if (this.isRendering) {
      console.log('Already rendering, skipping');
      return;
    }
    
    this.isRendering = true;

    try {
      // Clear container
      if (this.chartContainer.nativeElement) {
        this.chartContainer.nativeElement.innerHTML = '';
      }
      
      const spec = this.buildVegaSpec();
      if (!spec) {
        console.error('Failed to build Vega spec');
        if (this.chartContainer.nativeElement) {
          this.chartContainer.nativeElement.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Invalid chart configuration</div>';
        }
        this.isRendering = false;
        return;
      }
      
      console.log('Rendering chart type:', this.chartType);
      console.log('Spec encoding:', spec.encoding);

      const result = await embed(this.chartContainer.nativeElement, spec, {
        actions: false,
        renderer: 'canvas',
        theme: 'ggplot2'
      });
      
      this.view = result.view;
      console.log('Chart rendered successfully for type:', this.chartType);
    } catch(error) {
      console.error('Vega embedding error:', error);
      if (this.chartContainer?.nativeElement) {
        this.chartContainer.nativeElement.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444;">
          Chart rendering error: ${error || 'Unknown error'}
        </div>`;
      }
    } finally {
      this.isRendering = false;
    }
  }

  private buildVegaSpec(): any {
    if (!this.data || this.data.length === 0) {
      console.log('No data for spec');
      return null;
    }

    const limitedData = this.data.slice(0, 200);
    const firstRow = limitedData[0];
    const allColumns = Object.keys(firstRow);
    
    console.log('Building spec for chart type:', this.chartType);
    console.log('Available columns:', allColumns);
    console.log('Input X Axis:', this.xAxis);
    console.log('Input Y Axis:', this.yAxis);

    let xField:any = this.xAxis;
    let yField:any = this.yAxis;

    // Auto-detect fields if not specified or invalid
    if (!xField || xField === 'undefined' || xField === 'null' || !allColumns.includes(xField)) {
      // Find a good x-axis column (prefer string/date columns)
      xField = allColumns.find(col => {
        const val = firstRow[col];
        return (typeof val === 'string' && !col.toLowerCase().includes('id')) || 
               col.toLowerCase().includes('date') ||
               col.toLowerCase().includes('name');
      });
      
      if (!xField) {
        xField = allColumns.find(col => typeof firstRow[col] === 'string');
      }
      
      if (!xField) {
        xField = allColumns[0];
      }
      console.log('Auto-detected X Axis:', xField);
    }

    // For pie charts, we don't always need a yField
    if (this.chartType !== 'pie') {
      if (!yField || yField === 'undefined' || yField === 'null' || !allColumns.includes(yField)) {
        // Find a numeric column for y-axis
        yField = allColumns.find(col => {
          const val = firstRow[col];
          return typeof val === 'number';
        });
        
        if (!yField && allColumns.length > 1) {
          yField = allColumns[1];
        }
        
        if (!yField) {
          yField = allColumns[0];
        }
        console.log('Auto-detected Y Axis:', yField);
      }
    }

    if (!xField) {
      console.log('Missing xField');
      return null;
    }

    // For non-pie charts, ensure yField exists
    if (this.chartType !== 'pie' && !yField) {
      console.log('Missing yField for chart type:', this.chartType);
      return null;
    }

    // Get sample values to determine types
    const xSample = firstRow[xField];
    const xFieldType = this.getFieldType(xSample);
    
    console.log(`X Field: ${xField}, Sample: ${xSample}, Type: ${xFieldType}`);

    // Build Vega-Lite spec based on chart type
    let spec: any = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: limitedData },
      width: 'container',
      height: 400,
      autosize: { type: 'fit', contains: 'padding' },
      background: 'white'
    };

    if (this.title && this.title !== 'Data Visualization') {
      spec.title = this.title;
    }

    // Handle different chart types
    switch (this.chartType) {
      case 'bar':
        const ySample = firstRow[yField];
        const yFieldType = this.getFieldType(ySample);
        spec.mark = { type: 'bar', tooltip: true };
        spec.encoding = {
          x: { field: xField, type: xFieldType, title: this.formatFieldName(xField), axis: { labelAngle: -45, labelLimit: 100 } },
          y: { field: yField, type: yFieldType, title: this.formatFieldName(yField) },
          color: { value: '#3b82f6' }
        };
        break;

      case 'line':
        const ySampleLine = firstRow[yField];
        const yFieldTypeLine = this.getFieldType(ySampleLine);
        spec.mark = { type: 'line', tooltip: true, point: true };
        spec.encoding = {
          x: { field: xField, type: xFieldType === 'quantitative' ? 'ordinal' : xFieldType, title: this.formatFieldName(xField) },
          y: { field: yField, type: yFieldTypeLine, title: this.formatFieldName(yField) },
          color: { value: '#3b82f6' }
        };
        break;

      case 'pie':
        // For pie charts, aggregate data by the x field
        const aggregatedData = this.aggregateDataForPie(limitedData, xField);
        if (aggregatedData.length === 0) {
          console.log('No aggregated data for pie chart');
          return null;
        }
        spec.data = { values: aggregatedData };
        spec.mark = { type: 'arc', tooltip: true };
        spec.encoding = {
          theta: { field: 'value', type: 'quantitative', title: 'Count' },
          color: { field: 'category', type: 'nominal', title: this.formatFieldName(xField) }
        };
        break;

      case 'area':
        const ySampleArea = firstRow[yField];
        const yFieldTypeArea = this.getFieldType(ySampleArea);
        spec.mark = { type: 'area', tooltip: true, point: true, line: true };
        spec.encoding = {
          x: { field: xField, type: xFieldType === 'quantitative' ? 'ordinal' : xFieldType, title: this.formatFieldName(xField) },
          y: { field: yField, type: yFieldTypeArea, title: this.formatFieldName(yField) },
          color: { value: '#3b82f6' }
        };
        break;

      case 'scatter':
        const ySampleScatter = firstRow[yField];
        if (typeof ySampleScatter !== 'number') {
          console.warn('Scatter plot works best with numeric fields. Using anyway.');
        }
        spec.mark = { type: 'circle', tooltip: true, opacity: 0.6 };
        spec.encoding = {
          x: { field: xField, type: 'quantitative', title: this.formatFieldName(xField) },
          y: { field: yField, type: 'quantitative', title: this.formatFieldName(yField) }
        };
        break;

      default:
        spec.mark = { type: 'bar', tooltip: true };
        spec.encoding = {
          x: { field: xField, type: xFieldType, title: this.formatFieldName(xField) },
          color: { value: '#3b82f6' }
        };
    }

    console.log('Final spec for', this.chartType, ':', spec);
    return spec;
  }

  private getFieldType(value: any): string {
    if (typeof value === 'number') return 'quantitative';
    if (typeof value === 'string') {
      // Check if it looks like a date
      if (value.match(/^\d{4}-\d{2}-\d{2}/) || value.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        return 'temporal';
      }
      return 'nominal';
    }
    return 'ordinal';
  }

  private aggregateDataForPie(data: any[], categoryField: string): any[] {
    // Aggregate data for pie chart - count occurrences of each category
    const aggregated = new Map();
    
    data.forEach(row => {
      const category = row[categoryField];
      if (category) {
        const categoryStr = String(category);
        if (aggregated.has(categoryStr)) {
          aggregated.set(categoryStr, aggregated.get(categoryStr) + 1);
        } else {
          aggregated.set(categoryStr, 1);
        }
      }
    });
    
    // Limit to top 10 categories for readability
    const sorted = Array.from(aggregated.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    
    console.log('Aggregated pie data:', sorted);
    return sorted;
  }

  private formatFieldName(field: string): string {
    if (!field) return '';
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}