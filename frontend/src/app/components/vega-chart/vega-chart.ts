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
  @Input() yAxisFields: string[] = [];
  @Input() yAxisPosition: string[] = [];
  @Input() groupBy: string = '';
  @Input() title: string = '';
  @Input() metric: string = 'count';
  @Input() metricColumn: string = '';

  private view: any = null;
  private isRendering: boolean = false;
  private renderTimeout: any = null;
  
  // Predefined color palette for multiple channels
  private colorPalette: string[] = [
    '#1f77b4',  // Blue
    '#ff7f0e',  // Orange
    '#2ca02c',  // Green
    '#d62728',  // Red
    '#9467bd',  // Purple
    '#8c564b',  // Brown
    '#e377c2',  // Pink
    '#7f7f7f',  // Gray
    '#bcbd22',  // Olive
    '#17becf'   // Cyan
  ];
  
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
    
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    
    if (changes['chartType'] && this.view) {
      console.log('Chart type changed from', changes['chartType'].previousValue, 'to', changes['chartType'].currentValue);
      try {
        this.view.destroy();
        this.view = null;
      } catch(e) {}
    }
    
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

    const limitedData = this.data.slice(0, 500);
    const firstRow = limitedData[0];
    const allColumns = Object.keys(firstRow);
    
    console.log('Building spec for chart type:', this.chartType);
    console.log('Available columns:', allColumns);
    
    // Check if we have multi-series data (contains '_series' field)
    const hasMultiSeries = limitedData.some(row => row['_series'] !== undefined);
    const hasMultipleYAxes = this.yAxisFields && this.yAxisFields.length > 1;
    
    console.log('Has multi-series:', hasMultiSeries);
    console.log('Has multiple Y axes:', hasMultipleYAxes);
    console.log('Y Axis Fields:', this.yAxisFields);
    
    // Determine X axis field
    let xField: any = this.xAxis;
    if (!xField || xField === 'undefined' || xField === 'null' || !allColumns.includes(xField)) {
      xField = allColumns.find(col => 
        col.toLowerCase().includes('date') || 
        col.toLowerCase().includes('time') ||
        col.toLowerCase().includes('createdat') ||
        col.toLowerCase().includes('timestamp')
      );
      
      if (!xField) {
        xField = allColumns.find(col => {
          const val = firstRow[col];
          return typeof val === 'string' && (val.includes(':') || val.match(/^\d{4}-\d{2}-\d{2}/));
        });
      }
      
      if (!xField) {
        xField = allColumns[0];
      }
      console.log('Auto-detected X Axis:', xField);
    }

    // Get field types
    const xSample = firstRow[xField];
    const xFieldType = this.getFieldType(xSample);
    
    console.log(`X Field: ${xField}, Type: ${xFieldType}`);
    
    // Build multi-axis chart if needed
    if (hasMultipleYAxes || (hasMultiSeries && limitedData.some(row => row['_yField']))) {
      console.log('Building multi-axis chart');
      return this.buildMultiAxisSpec(limitedData, xField, xFieldType);
    }
    
    // Build single-axis chart
    return this.buildSingleAxisSpec(limitedData, xField, xFieldType, hasMultiSeries);
  }

  private buildMultiAxisSpec(data: any[], xField: string, xFieldType: string): any {
    console.log('Building multi-axis spec with', this.yAxisFields.length, 'axes');
    
    // Group data by series/channel
    const seriesMap = new Map();
    
    data.forEach(row => {
      const seriesName = row['_series'] || 'Series';
      const yField = row['_yField'] || this.yAxisFields[0] || 'value';
      const value = row['value'] !== undefined ? row['value'] : row[yField];
      const xValue = row[xField];
      
      if (!seriesMap.has(seriesName)) {
        seriesMap.set(seriesName, []);
      }
      
      if (xValue !== undefined && xValue !== null && value !== undefined && value !== null && !isNaN(value)) {
        seriesMap.get(seriesName).push({
          [xField]: xValue,
          value: value,
          originalYField: yField
        });
      }
    });
    
    // Get unique series
    const uniqueSeries = Array.from(seriesMap.keys());
    console.log('Unique series found:', uniqueSeries);
    
    if (uniqueSeries.length === 0) {
      console.log('No series data found');
      return null;
    }
    
    // Create layers for each series
    const layers: any[] = [];
    
    uniqueSeries.forEach((series, index) => {
      const seriesData = seriesMap.get(series);
      if (!seriesData || seriesData.length === 0) return;
      
      // Alternate y-axis position
      const yAxisPosition = index % 2 === 0 ? 'left' : 'right';
      const seriesColor = this.colorPalette[index % this.colorPalette.length];
      
      // Determine mark type
      let markConfig: any;
      switch (this.chartType) {
        case 'bar':
          markConfig = { type: 'bar', tooltip: true };
          break;
        case 'line':
          markConfig = { type: 'line', tooltip: true, point: { size: 30, filled: true } };
          break;
        case 'area':
          markConfig = { type: 'area', tooltip: true, opacity: 0.7, line: true };
          break;
        case 'point':
        case 'scatter':
          markConfig = { type: 'circle', tooltip: true, opacity: 0.6, size: 60 };
          break;
        default:
          markConfig = { type: 'line', tooltip: true, point: true };
      }
      
      // Create layer for this series
      const layer = {
        mark: markConfig,
        encoding: {
          x: {
            field: xField,
            type: xFieldType === 'quantitative' ? 'temporal' : xFieldType,
            title: this.formatFieldName(xField),
            axis: {
              titleColor: '#333',
              labelAngle: -45,
              labelLimit: 100
            },
            sort: null
          },
          y: {
            field: 'value',
            type: 'quantitative',
            title: series,
            axis: {
              titleColor: seriesColor,
              labelColor: seriesColor,
              grid: index === 0, // Only show grid for first axis
              orient: yAxisPosition,
              titleFontWeight: 'bold'
            }
          },
          color: {
            value: seriesColor
          },
          tooltip: [
            { field: xField, type: xFieldType, title: this.formatFieldName(xField) },
            { field: 'value', type: 'quantitative', title: series, format: '.2f' }
          ]
        },
        data: { values: seriesData }
      };
      
      layers.push(layer);
    });
    
    if (layers.length === 0) {
      console.log('No layers created');
      return null;
    }
    
    // Return layered spec with independent y-scales
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      layer: layers,
      width: 'container',
      height: 400,
      autosize: { type: 'fit', contains: 'padding' },
      background: 'white',
      title: this.title || 'Multi-Axis Chart',
      resolve: {
        scale: {
          y: 'independent' // Key: independent y-axes for each layer
        },
        axis: {
          y: 'independent' // Independent y-axes labels
        }
      }
    };
  }

  private buildSingleAxisSpec(data: any[], xField: string, xFieldType: string, hasMultiSeries: boolean): any {
    const firstRow = data[0];
    const allColumns = Object.keys(firstRow);
    
    // Determine Y axis field
    let yField: any = this.yAxis;
    if (!hasMultiSeries) {
      if (!yField || yField === 'undefined' || yField === 'null' || !allColumns.includes(yField)) {
        yField = allColumns.find(col => {
          const val = firstRow[col];
          return typeof val === 'number';
        });
        
        if (!yField && allColumns.length > 1) {
          yField = allColumns[1];
        }
        console.log('Auto-detected Y Axis:', yField);
      }
    }
    
    // Get series field for multi-series
    const seriesField = hasMultiSeries ? '_series' : (this.groupBy || null);
    
    // Get unique series names for domain
    const seriesDomain = hasMultiSeries ? this.getUniqueSeriesNames(data, seriesField as string) : [];
    
    // Build color encoding for multi-series
    const colorEncoding = hasMultiSeries ? {
      field: seriesField,
      type: 'nominal' as const,
      title: 'Channel',
      scale: {
        domain: seriesDomain,
        range: this.colorPalette.slice(0, seriesDomain.length)
      },
      legend: { title: 'Channel', orient: 'top-right' }
    } : { value: '#3b82f6' };
    
    // Build Vega-Lite spec
    let spec: any = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: data },
      width: 'container',
      height: 400,
      autosize: { type: 'fit', contains: 'padding' },
      background: 'white'
    };
    
    if (this.title && this.title !== 'Data Visualization') {
      spec.title = this.title;
    }
    
    // Build encoding based on chart type
    switch (this.chartType) {
      case 'bar':
        if (hasMultiSeries) {
          spec.mark = { type: 'bar', tooltip: true };
          spec.encoding = {
            x: { field: xField, type: xFieldType, title: this.formatFieldName(xField), axis: { labelAngle: -45, labelLimit: 100 } },
            y: { field: 'value', type: 'quantitative', title: 'Value', aggregate: 'mean' },
            color: colorEncoding,
            xOffset: { field: seriesField, type: 'nominal' }
          };
        } else if (yField) {
          const yFieldType = this.getFieldType(firstRow[yField]);
          spec.mark = { type: 'bar', tooltip: true };
          spec.encoding = {
            x: { field: xField, type: xFieldType, title: this.formatFieldName(xField), axis: { labelAngle: -45, labelLimit: 100 } },
            y: { field: yField, type: yFieldType, title: this.formatFieldName(yField) },
            color: { value: '#3b82f6' }
          };
        } else {
          spec.mark = { type: 'bar', tooltip: true };
          spec.encoding = {
            x: { field: xField, type: xFieldType, title: this.formatFieldName(xField), axis: { labelAngle: -45, labelLimit: 100 } },
            y: { aggregate: 'count', title: 'Count' },
            color: { value: '#3b82f6' }
          };
        }
        break;
        
      case 'line':
        if (hasMultiSeries) {
          spec.mark = { type: 'line', tooltip: true, point: { size: 30, filled: true } };
          spec.encoding = {
            x: { field: xField, type: xFieldType === 'quantitative' ? 'temporal' : xFieldType, title: this.formatFieldName(xField), sort: null },
            y: { field: 'value', type: 'quantitative', title: 'Value' },
            color: colorEncoding,
            strokeDash: { field: seriesField, type: 'nominal', legend: null }
          };
        } else if (yField) {
          const yFieldType = this.getFieldType(firstRow[yField]);
          spec.mark = { type: 'line', tooltip: true, point: true };
          spec.encoding = {
            x: { field: xField, type: xFieldType === 'quantitative' ? 'ordinal' : xFieldType, title: this.formatFieldName(xField) },
            y: { field: yField, type: yFieldType, title: this.formatFieldName(yField) },
            color: { value: '#3b82f6' }
          };
        } else {
          spec.mark = { type: 'line', tooltip: true, point: true };
          spec.encoding = {
            x: { field: xField, type: xFieldType, title: this.formatFieldName(xField) },
            y: { aggregate: 'count', title: 'Count' },
            color: { value: '#3b82f6' }
          };
        }
        break;
        
      case 'area':
        if (hasMultiSeries) {
          spec.mark = { type: 'area', tooltip: true, point: true, line: true, opacity: 0.7 };
          spec.encoding = {
            x: { field: xField, type: xFieldType === 'quantitative' ? 'temporal' : xFieldType, title: this.formatFieldName(xField) },
            y: { field: 'value', type: 'quantitative', title: 'Value', stack: false },
            color: colorEncoding
          };
        } else if (yField) {
          const yFieldType = this.getFieldType(firstRow[yField]);
          spec.mark = { type: 'area', tooltip: true, point: true, line: true };
          spec.encoding = {
            x: { field: xField, type: xFieldType === 'quantitative' ? 'ordinal' : xFieldType, title: this.formatFieldName(xField) },
            y: { field: yField, type: yFieldType, title: this.formatFieldName(yField) },
            color: { value: '#3b82f6' }
          };
        } else {
          spec.mark = { type: 'area', tooltip: true, point: true, line: true };
          spec.encoding = {
            x: { field: xField, type: xFieldType, title: this.formatFieldName(xField) },
            y: { aggregate: 'count', title: 'Count' },
            color: { value: '#3b82f6' }
          };
        }
        break;
        
      case 'point':
      case 'scatter':
        if (hasMultiSeries) {
          spec.mark = { type: 'circle', tooltip: true, opacity: 0.6 };
          spec.encoding = {
            x: { field: xField, type: 'quantitative', title: this.formatFieldName(xField) },
            y: { field: 'value', type: 'quantitative', title: 'Value' },
            color: colorEncoding,
            size: { value: 60 }
          };
        } else if (yField) {
          spec.mark = { type: 'circle', tooltip: true, opacity: 0.6 };
          spec.encoding = {
            x: { field: xField, type: 'quantitative', title: this.formatFieldName(xField) },
            y: { field: yField, type: 'quantitative', title: this.formatFieldName(yField) },
            color: { value: '#3b82f6' }
          };
        } else {
          spec.mark = { type: 'circle', tooltip: true, opacity: 0.6 };
          spec.encoding = {
            x: { field: xField, type: xFieldType, title: this.formatFieldName(xField) },
            y: { aggregate: 'count', title: 'Count' },
            color: { value: '#3b82f6' }
          };
        }
        break;
        
      default:
        spec.mark = { type: 'bar', tooltip: true };
        spec.encoding = {
          x: { field: xField, type: xFieldType, title: this.formatFieldName(xField) },
          y: { aggregate: 'count', title: 'Count' },
          color: hasMultiSeries ? colorEncoding : { value: '#3b82f6' }
        };
    }
    
    console.log('Final spec for', this.chartType, 'with multi-series:', hasMultiSeries);
    return spec;
  }
  
  private getUniqueSeriesNames(data: any[], seriesField: string): string[] {
    const names = new Set<string>();
    data.forEach(row => {
      if (row[seriesField]) {
        names.add(String(row[seriesField]));
      }
    });
    return Array.from(names);
  }
  
  private getFieldType(value: any): string {
    if (typeof value === 'number') return 'quantitative';
    if (typeof value === 'string') {
      if (value.match(/^\d{4}-\d{2}-\d{2}/) || value.match(/^\d{2}\/\d{2}\/\d{4}/) || value.includes(':')) {
        return 'temporal';
      }
      return 'nominal';
    }
    return 'ordinal';
  }
  
  private formatFieldName(field: string): string {
    if (!field) return '';
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}