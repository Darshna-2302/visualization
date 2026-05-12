import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { DatabaseService } from '../../services/database.service';
import { ToastService } from '../../services/toast.service';
import { SavedQuestionsService } from '../../services/saved-Question.service';
import { AuthService } from '../../services/auth';
import { DatabaseConnection, QueryResult } from '../../components/models/database.models';
import { VegaChart } from '../vega-chart/vega-chart';

@Component({
  selector: 'app-query-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, VegaChart],
  templateUrl: './query-builder.component.html',
  styleUrls: ['./query-builder.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QueryBuilderComponent implements OnInit, OnDestroy {
  activeTab: 'visual' | 'sql' = 'visual';
  sqlQuery: string = 'SELECT * FROM orders LIMIT 10';
  selectedTable: string = 'orders';
  selectedConnection: DatabaseConnection | null = null;
  tables: string[] = [];
  columns: { name: string; selected: boolean; type: string }[] = [];
  filters: { column: string; operator: string; value: string }[] = [];
  groupBy: string = '';
  metric: string = 'count';
  metricColumn: string = '';
  chartType: string = 'table';
  results: QueryResult | null = null;
  loading: boolean = false;
  
  // Chart data
  chartData: any[] = [];
  chartTitle: string = '';
  xAxisField: string = '';
  yAxisField: string = '';
  showChart: boolean = false;
  
  // Pre-processed data for template to avoid function calls
  availableColumns: { name: string; type: string }[] = [];
  numericColumns: { name: string; type: string }[] = [];
  resultsColumns: string[] = [];
  resultsRows: any[] = [];
  resultsRowCount: number = 0;
  resultsExecutionTime: number = 0;
  
  private subscriptions: Subscription = new Subscription();
  private renderTimeout: any = null;
  
  chartTypes = [
    { value: 'table', label: 'Table', icon: 'table_view' },
    { value: 'bar', label: 'Bar Chart', icon: 'bar_chart' },
    { value: 'line', label: 'Line Chart', icon: 'show_chart' },
    { value: 'pie', label: 'Pie Chart', icon: 'pie_chart' },
    { value: 'area', label: 'Area Chart', icon: 'area_chart' },
    { value: 'scatter', label: 'Scatter Plot', icon: 'scatter_plot' }
  ];
  
  constructor(
    private dbService: DatabaseService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private savedQuestionsService: SavedQuestionsService,
    private authService: AuthService
  ) {}
  
  ngOnInit() {
    this.subscriptions.add(
      this.dbService.activeConnection$.subscribe(connection => {
        this.selectedConnection = connection;
        if (connection) {
          this.loadTables();
          this.toastService.showToast(`Connected to ${connection.name}`, 'success');

          setTimeout(() => {
          this.checkForSavedQuestion();
        }, 500);
        } else {
          this.tables = [];
          this.columns = [];
          this.results = null;
          this.chartData = [];
          this.showChart = false;
          this.updatePreProcessedData();
        }
        this.cdr.markForCheck();
      })
    );
  }
    // Add this method to ensure query runs after columns are loaded
private runQueryAfterLoad(question: any) {
  // Check if columns are loaded
  if (this.columns.length > 0) {
    if (question.type === 'sql') {
      this.runSqlQuery();
    } else {
      this.runQuery();
    }
  } else {
    // Wait a bit more for columns to load
    setTimeout(() => {
      this.runQueryAfterLoad(question);
    }, 200);
  }
}

// private checkForSavedQuestion() {
//   const loadData = localStorage.getItem('load_question');
//   if (loadData) {
//     try {
//       const question = JSON.parse(loadData);
//       console.log('Loading saved question:', question);
      
//       // Set the question data with null checks
//       this.activeTab = question.type || 'visual';
//       this.sqlQuery = question.query || '';
//       this.selectedTable = question.table || question.tableName || '';
//       this.groupBy = question.groupBy || '';
//       this.metric = question.metric || 'count';
//       this.metricColumn = question.metricColumn || '';
//       this.chartType = question.chartType || 'table';
      
//       // Clear the stored data immediately
//       localStorage.removeItem('load_question');
      
//       // If it's a visual builder question, set filters and selected columns
//       if (question.type === 'visual') {
//         if (question.filters && question.filters.length) {
//           this.filters = question.filters;
//         }
        
//         const selectedColumnsToApply = question.selectedColumns || [];
//         console.log("columnsTo apply ", selectedColumnsToApply);
        
//         // Load columns and run query
//         if (this.selectedTable && this.selectedConnection) {
//           const columnsSub = this.dbService.getTableColumns(this.selectedTable, this.selectedConnection.id).subscribe(columnNames => {
//             this.columns = columnNames.map(name => ({
//               name,
//               selected: selectedColumnsToApply.includes(name),
//               type: this.inferColumnType(name)
//             }));
//             console.log("column loaded with selection", this.columns);
//             this.updatePreProcessedData();
//             this.cdr.markForCheck();

//             setTimeout(() => {
//               this.runQuery();
//             }, 500);

//             columnsSub.unsubscribe();
//           });
//         }
//       } else {
//         setTimeout(() => {
//           this.runSqlQuery();
//         }, 500);
//       }
//       this.toastService.showToast(`loaded: ${question.name}`, 'success');
//     } catch (error) {
//       console.error('Error loading question:', error);
//       this.toastService.showToast('Error loading saved question', 'error');
//     }
//   }
// }

private checkForSavedQuestion() {
  const loadData = localStorage.getItem('load_question');
  if (loadData) {
    try {
      const question = JSON.parse(loadData);
      console.log('Loading saved question:', question);
      
      // Set the question data with proper null/undefined checks
      this.activeTab = question.type || 'visual';
      this.sqlQuery = question.query || '';
      this.selectedTable = question.table || question.tableName || '';
      this.groupBy = question.groupBy || '';
      this.metric = question.metric || 'count';
      this.metricColumn = question.metricColumn || '';
      this.chartType = question.chartType || 'table';
      
      // Clear the stored data immediately to prevent reloading
      localStorage.removeItem('load_question');
      
      // If it's a visual builder question, set filters and selected columns
      if (question.type === 'visual') {
        // Set filters if they exist
        if (question.filters && Array.isArray(question.filters) && question.filters.length > 0) {
          this.filters = question.filters;
        } else {
          this.filters = [];
        }
        
        const selectedColumnsToApply = question.selectedColumns || [];
        console.log("Columns to apply:", selectedColumnsToApply);
        
        // Load columns first, then run query
        if (this.selectedTable && this.selectedConnection) {
          this.loadColumnsForSavedQuestion(selectedColumnsToApply);
        } else {
          this.toastService.showToast('Please select a database connection first', 'error');
        }
      } else if (question.type === 'sql') {
        console.log("question type", question.type);
        // For SQL queries, just run the query
        setTimeout(() => {
          this.runSqlQuery();
        }, 500);
      }
      
      this.toastService.showToast(`Loaded: ${question.name}`, 'success');
    } catch (error) {
      console.error('Error loading question:', error);
      this.toastService.showToast('Error loading saved question', 'error');
    }
  }
}

private loadColumnsForSavedQuestion(selectedColumnsToApply: string[]) {
  const columnsSub = this.dbService.getTableColumns(this.selectedTable, this.selectedConnection!.id).subscribe({
    next: (columnNames) => {
      this.columns = columnNames.map(name => ({
        name,
        selected: selectedColumnsToApply.includes(name),
        type: this.inferColumnType(name)
      }));
      console.log("Columns loaded with selection:", this.columns);
      this.updatePreProcessedData();
      this.cdr.markForCheck();

      // Run the query after columns are loaded
      setTimeout(() => {
        this.runQuery();
        
        // Force chart to render after query completes
        setTimeout(() => {
          this.forceChartRender();
        }, 1000);
      }, 500);
    },
    error: (error) => {
      console.error('Error loading columns:', error);
      this.toastService.showToast('Error loading table columns', 'error');
    }
  });
  columnsSub.unsubscribe();
}

private forceChartRender() {
  if (this.chartType !== 'table' && this.results && this.results.rows && this.results.rows.length > 0) {
    this.updateChartData();
    this.showChart = true;
    this.cdr.markForCheck();
    console.log('Chart forced to render with type:', this.chartType);
  }
}
  
  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
  }
  
  // Update all pre-processed data to avoid function calls in template
  private updatePreProcessedData() {
    this.availableColumns = this.columns.map(c => ({ name: c.name, type: c.type }));
    this.numericColumns = this.columns.filter(c => c.type === 'number');
    
    if (this.results) {
      this.resultsColumns = this.results.columns || [];
      this.resultsRows = this.results.rows || [];
      this.resultsRowCount = this.results.rowCount || 0;
      this.resultsExecutionTime = this.results.executionTime || 0;
    } else {
      this.resultsColumns = [];
      this.resultsRows = [];
      this.resultsRowCount = 0;
      this.resultsExecutionTime = 0;
    }
  }
  

  // Add this method to force chart refresh
forceChartRefresh() {
  setTimeout(() => {
    if (this.chartType !== 'table' && this.results && this.results.rows && this.results.rows.length > 0) {
      this.updateChartData();
      this.cdr.markForCheck();
      console.log('Chart refreshed with type:', this.chartType);
    }
  }, 100);
}


  loadTables() {
    if (this.selectedConnection) {
      this.subscriptions.add(
        this.dbService.getTablesForConnection(this.selectedConnection.id).subscribe(tables => {
          this.tables = tables;
          if (tables.length > 0 && !this.selectedTable) {
            this.selectedTable = tables[0];
            this.loadColumns();
          }
          this.cdr.markForCheck();
        })
      );
    }
  }
  
  loadColumns() {
    if (this.selectedTable && this.selectedConnection) {
      this.subscriptions.add(
        this.dbService.getTableColumns(this.selectedTable, this.selectedConnection.id).subscribe(columnNames => {
          this.columns = columnNames.map(name => ({
            name,
            selected: true,
            type: this.inferColumnType(name)
          }));
          this.updatePreProcessedData();
          this.cdr.markForCheck();
        })
      );
    }
  }
  
  inferColumnType(columnName: string): string {
    const numericColumns = ['id', 'amount', 'price', 'value', 'count', 'revenue', 'expenses', 'profit', 'quantity', 'total'];
    const dateColumns = ['date', 'created_at', 'updated_at', 'signup_date'];
    
    const lowerName = columnName.toLowerCase();
    if (numericColumns.some(col => lowerName.includes(col))) {
      return 'number';
    }
    if (dateColumns.some(col => lowerName.includes(col))) {
      return 'date';
    }
    return 'string';
  }
  
  formatColumnName(columnName: string): string {
    return columnName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  onTableChange() {
    this.loadColumns();
    this.filters = [];
    this.groupBy = '';
    this.metricColumn = '';
    this.results = null;
    this.chartData = [];
    this.showChart = false;
    this.updatePreProcessedData();
    this.cdr.markForCheck();
  }
  
  addFilter() {
    this.filters.push({ column: '', operator: '=', value: '' });
    this.cdr.markForCheck();
  }
  
  removeFilter(index: number) {
    this.filters.splice(index, 1);
    this.cdr.markForCheck();
  }
  
private updateChartData() {
  console.log('Updating chart data, chartType:', this.chartType);
  
  if (!this.results || !this.results.rows || this.results.rows.length === 0) {
    this.showChart = false;
    console.log('No results, showChart set to false');
    return;
  }
  
  // Clean and process data - preserve numeric values
  this.chartData = this.results.rows.map(row => {
    const cleanRow: any = {};
    for (const [key, value] of Object.entries(row)) {
      // Keep original key names for better mapping
      cleanRow[key] = value;
    }
    return cleanRow;
  });
  
  console.log('Processed chart data sample:', this.chartData[0]);
  console.log('Available columns:', Object.keys(this.chartData[0] || {}));
  
  // Update chart title based on chart type and data
  if (this.chartType !== 'table') {
    if (this.groupBy) {
      const metricName = this.metric === 'count' ? 'Count' : 
                         this.metric === 'sum' ? 'Sum' : 
                         this.metric === 'avg' ? 'Average' : 'Value';
      this.chartTitle = `${metricName} by ${this.formatColumnName(this.groupBy)}`;
    } else {
      const chartTypeNames: { [key: string]: string } = {
        'bar': 'Bar Chart',
        'line': 'Line Chart',
        'pie': 'Pie Chart',
        'area': 'Area Chart',
        'scatter': 'Scatter Plot'
      };
      this.chartTitle = chartTypeNames[this.chartType] || 'Data Visualization';
    }
  }
  
  // Update x-axis field
  if (this.results && this.results.columns) {
    const columns = this.results.columns;
    if (this.groupBy) {
      this.xAxisField = this.groupBy;
    } else if (columns.length > 0) {
      // Find a good x-axis column (prefer string/date columns)
      let xCol = columns.find(col => {
        const sample = this.results?.rows[0]?.[col];
        return typeof sample === 'string' && !col.toLowerCase().includes('id');
      });
      
      if (!xCol) {
        xCol = columns.find(col => {
          const sample = this.results?.rows[0]?.[col];
          return typeof sample === 'string';
        });
      }
      
      if (!xCol) {
        xCol = columns[0];
      }
      
      this.xAxisField = xCol;
    }
  }
  
  // Update y-axis field
  if (this.metricColumn && this.metric !== 'count') {
    this.yAxisField = this.metricColumn;
  } else if (this.results && this.results.columns && this.results.rows && this.results.rows.length > 0) {
    const columns = this.results.columns;
    // Find a numeric column for y-axis
    let yCol = columns.find(col => {
      const sample = this.results?.rows[0]?.[col];
      return typeof sample === 'number';
    });
    
    if (!yCol && columns.length > 1) {
      yCol = columns[1];
    } else if (!yCol) {
      yCol = columns[0];
    }
    
    this.yAxisField = yCol;
  }
  
  console.log('Final xAxisField:', this.xAxisField);
  console.log('Final yAxisField:', this.yAxisField);
  
  // Determine if chart should be shown - IMPORTANT: Use the current chartType
  this.showChart = this.chartType !== 'table' && this.chartData.length > 0;
  console.log('showChart set to:', this.showChart, 'chartType:', this.chartType, 'chartData length:', this.chartData.length);
}

  buildQuery(): string {
    const selectedCols = this.columns.filter(c => c.selected).map(c => c.name);
    let selectClause = selectedCols.length > 0 ? selectedCols.join(', ') : '*';
    let query = `SELECT ${selectClause} FROM ${this.selectedTable}`;
    
    const activeFilters = this.filters.filter(f => f.column && f.value);
    if (activeFilters.length > 0) {
      const whereClause = activeFilters.map(f => {
        if (f.operator === 'contains') {
          return `${f.column} LIKE '%${f.value}%'`;
        }
        return `${f.column} ${f.operator} '${f.value}'`;
      }).join(' AND ');
      query += ` WHERE ${whereClause}`;
    }
    
    if (this.groupBy) {
      if (this.metric === 'count') {
        query = `SELECT ${this.groupBy}, COUNT(*) as count FROM ${this.selectedTable}`;
      } else if (this.metric === 'sum' && this.metricColumn) {
        query = `SELECT ${this.groupBy}, SUM(${this.metricColumn}) as sum FROM ${this.selectedTable}`;
      } else if (this.metric === 'avg' && this.metricColumn) {
        query = `SELECT ${this.groupBy}, AVG(${this.metricColumn}) as avg FROM ${this.selectedTable}`;
      }
      
      if (activeFilters.length > 0) {
        const whereClause = activeFilters.map(f => {
          if (f.operator === 'contains') {
            return `${f.column} LIKE '%${f.value}%'`;
          }
          return `${f.column} ${f.operator} '${f.value}'`;
        }).join(' AND ');
        query += ` WHERE ${whereClause}`;
      }
      query += ` GROUP BY ${this.groupBy}`;
    }
    
    query += ` LIMIT 500`;
    return query;
  }


async runQuery() {
  if (!this.selectedTable) {
    this.toastService.showToast('Please select a table', 'error');
    return;
  }
  
  this.loading = true;
  this.showChart = false; // Reset chart visibility
  this.cdr.markForCheck();
  
  const query = this.buildQuery();
  console.log('Executing query:', query);
  console.log('Current chart type:', this.chartType);
  
  this.subscriptions.add(
    this.dbService.executeQuery(query, this.selectedConnection?.id).subscribe({
      next: (result) => {
        this.results = result;
        this.loading = false;
        this.updatePreProcessedData();
        
        // Update chart data
        this.updateChartData();
        
        // Force chart to show if chartType is not 'table'
        if (this.chartType !== 'table' && result.rows && result.rows.length > 0) {
          this.showChart = true;
          console.log('Chart should be displayed, type:', this.chartType);
          console.log('Chart data length:', this.chartData.length);
          console.log('X Axis Field:', this.xAxisField);
          console.log('Y Axis Field:', this.yAxisField);
        }
        
        this.toastService.showToast(`Query returned ${result.rowCount} rows`, 'success');
        this.cdr.markForCheck();
        
        // Extra delay to ensure chart renders
        setTimeout(() => {
          this.cdr.markForCheck();
        }, 100);
      },
      error: (error) => {
        console.error('Query error:', error);
        this.loading = false;
        this.toastService.showToast(`Query failed: ${error.message || 'Unknown error'}`, 'error');
        this.cdr.markForCheck();
      }
    })
  );
}
  
  runSqlQuery() {
    if (!this.sqlQuery.trim()) {
      this.toastService.showToast('Please enter a SQL query', 'error');
      return;
    }
    
    this.loading = true;
    this.cdr.markForCheck();
    
    this.subscriptions.add(
      this.dbService.executeQuery(this.sqlQuery, this.selectedConnection?.id).subscribe({
        next: (result) => {
          this.results = result;
          this.loading = false;
          this.updatePreProcessedData();
          this.updateChartData();
          this.toastService.showToast(`Query returned ${result.rowCount} rows`, 'success');
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Query error:', error);
          this.loading = false;
          this.toastService.showToast(`Query failed: ${error.message || 'Unknown error'}`, 'error');
          this.cdr.markForCheck();
        }
      })
    );
  }
  
  getStatusClass(status: string): string {
    if (!status) return '';
    const statusLower = String(status).toLowerCase();
    if (statusLower === 'paid' || statusLower === 'completed' || statusLower === 'active') {
      return 'status-badge paid';
    }
    if (statusLower === 'pending') {
      return 'status-badge pending';
    }
    if (statusLower === 'cancelled') {
      return 'status-badge cancelled';
    }
    return '';
  }
  
  onChartTypeChange(newType: string) {
    console.log('Chart type changed to:', newType);
    
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    
    // Update chart type
    this.chartType = newType;
    
    // Debounce the update
    this.renderTimeout = setTimeout(() => {
      this.updateChartData();
      this.cdr.markForCheck();
    }, 50);
  }
  
  // Also update your saveQuestion method to save more details
saveQuestion() {
  const name = prompt('Enter question name:');
  if (!name || !name.trim()) return;

  const selectedColumns = this.columns.filter(c => c.selected).map(c => c.name);
  
  // Convert null values to undefined
  const questionPayload = {
    Name: name.trim(),
    Type: this.activeTab,
    Query: this.activeTab === 'sql' ? this.sqlQuery : this.buildQuery(),
    TableName: this.selectedTable || '',
    GroupBy: this.groupBy || undefined,
    Metric: this.metric || undefined,
    MetricColumn: this.metricColumn || undefined,
    ChartType: this.chartType || undefined,
    Filters: this.filters && this.filters.length ? this.filters : undefined,
    SelectedColumns: selectedColumns.length ? selectedColumns : undefined
  };

  // If authenticated, save to backend; otherwise fall back to localStorage
  const token = this.authService.getToken();
  if (token) {
    this.savedQuestionsService.saveQuestion({
      name: questionPayload.Name,
      type: questionPayload.Type,
      query: questionPayload.Query,
      table: questionPayload.TableName,  // Add this - use 'table' not 'tableName'
      tableName: questionPayload.TableName,  // Keep tableName if your API expects it
      groupBy: questionPayload.GroupBy,
      metric: questionPayload.Metric,
      metricColumn: questionPayload.MetricColumn,
      chartType: questionPayload.ChartType,
      filters: questionPayload.Filters,
      selectedColumns: questionPayload.SelectedColumns
    }).subscribe({
      next: (saved) => {
        this.toastService.showToast(`Question "${name}" saved to server`, 'success');
        // Notify other components
        window.dispatchEvent(new CustomEvent('savedQuestionsUpdated'));
      },
      error: (err) => {
        console.error('Error saving question to backend:', err);
        this.toastService.showToast('Failed to save question to server, saved locally instead', 'info');
        // fallback to local storage
        const savedQuestions = JSON.parse(localStorage.getItem('saved_questions') || '[]');
        savedQuestions.push({ 
          id: Date.now(), 
          name: name.trim(), 
          type: this.activeTab, 
          query: questionPayload.Query, 
          table: questionPayload.TableName, 
          createdAt: new Date().toISOString(), 
          connectionId: this.selectedConnection?.id, 
          connectionName: this.selectedConnection?.name, 
          groupBy: this.groupBy, 
          metric: this.metric, 
          metricColumn: this.metricColumn, 
          chartType: this.chartType, 
          filters: this.filters, 
          selectedColumns 
        });
        localStorage.setItem('saved_questions', JSON.stringify(savedQuestions));
        window.dispatchEvent(new CustomEvent('savedQuestionsUpdated'));
      }
    });
  } else {
    const savedQuestions = JSON.parse(localStorage.getItem('saved_questions') || '[]');
    savedQuestions.push({ 
      id: Date.now(), 
      name: name.trim(), 
      type: this.activeTab, 
      query: questionPayload.Query, 
      table: questionPayload.TableName, 
      createdAt: new Date().toISOString(), 
      connectionId: this.selectedConnection?.id, 
      connectionName: this.selectedConnection?.name, 
      groupBy: this.groupBy, 
      metric: this.metric, 
      metricColumn: this.metricColumn, 
      chartType: this.chartType, 
      filters: this.filters, 
      selectedColumns 
    });
    localStorage.setItem('saved_questions', JSON.stringify(savedQuestions));
    window.dispatchEvent(new CustomEvent('savedQuestionsUpdated'));
    this.toastService.showToast(`Question "${name}" saved locally`, 'success');
  }
}
  
  // TrackBy methods
  trackByColumnName(index: number, item: any): string {
    return item?.name || index.toString();
  }
  
  trackByIndex(index: number, item: any): number {
    return index;
  }
  
  trackByChartType(index: number, item: any): string {
    return item?.value;
  }
}