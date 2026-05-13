import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, of, Subscription } from 'rxjs';
import { DatabaseService } from '../../services/database.service';
import { ToastService } from '../../services/toast.service';
import { SavedQuestionsService } from '../../services/saved-Question.service';
import { AuthService } from '../../services/auth';
import { DatabaseConnection, QueryResult } from '../../components/models/database.models';
import { VegaChart } from '../vega-chart/vega-chart';

// ─── Join entry model ──────────────────────────────────────────────────────
interface JoinEntry {
  table: string;
  type: string;
  condition: string;
  leftCol: string;
  rightCol: string;
  columns: { name: string; selected: boolean; type: string }[];
}

@Component({
  selector: 'app-query-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, VegaChart],
  templateUrl: './query-builder.component.html',
  styleUrls: ['./query-builder.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QueryBuilderComponent implements OnInit, OnDestroy {

  // ── Existing state ──────────────────────────────────────────────────────
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

  // Pre-processed data for template (avoid function calls)
  availableColumns: { name: string; type: string }[] = [];
  numericColumns: { name: string; type: string }[] = [];
  resultsColumns: string[] = [];
  resultsRows: any[] = [];
  resultsRowCount: number = 0;
  resultsExecutionTime: number = 0;

  private subscriptions: Subscription = new Subscription();
  private renderTimeout: any = null;

  chartTypes = [
    { value: 'table',   label: 'Table',        icon: 'table_view'  },
    { value: 'bar',     label: 'Bar Chart',    icon: 'bar_chart'   },
    { value: 'line',    label: 'Line Chart',   icon: 'show_chart'  },
    { value: 'pie',     label: 'Pie Chart',    icon: 'pie_chart'   },
    { value: 'area',    label: 'Area Chart',   icon: 'area_chart'  },
    { value: 'scatter', label: 'Scatter Plot', icon: 'scatter_plot'},
  ];

  // ── JOIN state (new) ────────────────────────────────────────────────────
  joinedTables: JoinEntry[] = [];
  showJoinModal = false;

  pendingJoin: { table: string; type: string; leftCol: string; rightCol: string } =
    { table: '', type: 'INNER', leftCol: '', rightCol: '' };

  pendingJoinColumns: { name: string; type: string }[] = [];

  joinTypes = [
    { value: 'INNER', label: 'Inner',  icon: 'join_inner', desc: 'Matching rows only'           },
    { value: 'LEFT',  label: 'Left',   icon: 'join_left',  desc: 'All left + matching right'    },
    { value: 'RIGHT', label: 'Right',  icon: 'join_right', desc: 'All right + matching left'    },
    { value: 'FULL',  label: 'Full',   icon: 'join_full',  desc: 'All rows from both tables'    },
  ];

  /** Tables not yet selected as primary or already joined */
  get availableJoinTables(): string[] {
    const used = [this.selectedTable, ...this.joinedTables.map(j => j.table)];
    return this.tables.filter(t => !used.includes(t));
  }

  /** Allow Add Related Table only when a primary table and at least one column selected */
  get canAddJoin(): boolean {
    return !!this.selectedTable && Array.isArray(this.columns) && this.columns.some(c => c.selected);
  }

  // ── Constructor ─────────────────────────────────────────────────────────
  constructor(
    private dbService: DatabaseService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private savedQuestionsService: SavedQuestionsService,
    private authService: AuthService
  ) {}

  // ── Lifecycle ───────────────────────────────────────────────────────────
  ngOnInit() {
    this.subscriptions.add(
      this.dbService.activeConnection$.subscribe(connection => {
        this.selectedConnection = connection;
        if (connection) {
          this.loadTables();
          this.toastService.showToast(`Connected to ${connection.name}`, 'success');
          setTimeout(() => { this.checkForSavedQuestion(); }, 500);
        } else {
          this.tables = [];
          this.columns = [];
          this.results = null;
          this.chartData = [];
          this.showChart = false;
          this.joinedTables = [];
          this.updatePreProcessedData();
        }
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    if (this.renderTimeout) clearTimeout(this.renderTimeout);
  }

  // ── Pre-processed data ──────────────────────────────────────────────────
  private updatePreProcessedData() {
    // Merge primary columns + qualified joined columns
    const allCols = [
      ...this.columns.map(c => ({ name: c.name, type: c.type })),
      ...this.joinedTables.flatMap(j =>
        j.columns.map(c => ({ name: `${j.table}.${c.name}`, type: c.type }))
      ),
    ];
    this.availableColumns = allCols;
    this.numericColumns   = allCols.filter(c => c.type === 'number');

    if (this.results) {
      this.resultsColumns      = this.results.columns  || [];
      this.resultsRows         = this.results.rows     || [];
      this.resultsRowCount     = this.results.rowCount || 0;
      this.resultsExecutionTime= this.results.executionTime || 0;
    } else {
      this.resultsColumns      = [];
      this.resultsRows         = [];
      this.resultsRowCount     = 0;
      this.resultsExecutionTime= 0;
    }
  }

  // ── Table / column loading ──────────────────────────────────────────────
  loadTables() {
    if (!this.selectedConnection) return;
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

  loadColumns() {
    if (!this.selectedTable || !this.selectedConnection) return;
    this.subscriptions.add(
      this.dbService.getTableColumns(this.selectedTable, this.selectedConnection.id).subscribe(columnNames => {
        this.columns = columnNames.map(name => ({
          name,
          selected: true,
          type: this.inferColumnType(name),
        }));
        this.updatePreProcessedData();
        this.cdr.markForCheck();
      })
    );
  }

  onTableChange() {
    this.loadColumns();
    this.filters     = [];
    this.groupBy     = '';
    this.metricColumn= '';
    this.results     = null;
    this.chartData   = [];
    this.showChart   = false;
    // Reset joins when primary table changes
    this.joinedTables  = [];
    this.showJoinModal = false;
    this.updatePreProcessedData();
    this.cdr.markForCheck();
  }

  // ── JOIN modal logic (new) ──────────────────────────────────────────────
  openJoinModal() {
    this.pendingJoin = { table: '', type: 'INNER', leftCol: '', rightCol: '' };
    this.pendingJoinColumns = [];
    this.showJoinModal      = true;
    this.cdr.markForCheck();
  }

  closeJoinModal(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.showJoinModal = false;
      this.cdr.markForCheck();
    }
  }

  onJoinTableChange() {
    this.pendingJoin.leftCol  = '';
    this.pendingJoin.rightCol = '';
    this.pendingJoinColumns   = [];
    if (!this.pendingJoin.table) return;
    this.dbService.getTableColumns(this.pendingJoin.table, this.selectedConnection?.id).subscribe({
      next: (columnNames) => {
        this.pendingJoinColumns = columnNames.map(name => ({
          name,
          type: this.inferColumnType(name),
        }));
        this.cdr.markForCheck();
      },
      error: () => this.toastService.showToast('Could not load columns for selected table', 'error'),
    });
  }

  

  confirmJoin() {
    if (!this.pendingJoin.table || !this.pendingJoin.leftCol || !this.pendingJoin.rightCol) return;

    const buildEntry = (columnNames: string[]) => {
      return {
        table:     this.pendingJoin.table,
        type:      this.pendingJoin.type,
        condition: `${this.selectedTable}.${this.pendingJoin.leftCol} = ${this.pendingJoin.table}.${this.pendingJoin.rightCol}`,
        leftCol:   this.pendingJoin.leftCol,
        rightCol:  this.pendingJoin.rightCol,
        columns:   columnNames.map(name => ({ name, selected: true, type: this.inferColumnType(name) })),
      } as JoinEntry;
    };

    // Attempt to fetch columns first (backend preferred), but fall back to local schema
    const fetchCols$ = this.selectedConnection
      ? this.dbService.getTableColumns(this.pendingJoin.table, this.selectedConnection.id)
      : this.dbService.getTableColumns(this.pendingJoin.table);

    this.subscriptions.add(
      fetchCols$.pipe(catchError(() => of([]))).subscribe(columnNames => {
        const entry = buildEntry(columnNames.length ? columnNames : [this.pendingJoin.rightCol]);

        // Verify join by running a lightweight backend query if we have a connection
        if (this.selectedConnection) {
          const testQuery = `SELECT ${this.selectedTable}.* FROM ${this.selectedTable} ${entry.type} JOIN ${entry.table} ON ${entry.condition} LIMIT 5`;
          this.dbService.executeQuery(testQuery, this.selectedConnection.id).pipe(
            catchError(() => of(null))
          ).subscribe(result => {
            this.joinedTables.push(entry);
            this.showJoinModal = false;
            this.updatePreProcessedData();
            if (result && (result.rowCount ?? (result.rows ? result.rows.length : 0)) >= 0) {
              this.toastService.showToast(`Joined "${entry.table}" (${entry.type} JOIN) — verified by backend`, 'success');
            } else {
              this.toastService.showToast(`Joined "${entry.table}" (${entry.type} JOIN) — could not verify with backend`, 'info');
            }
            this.cdr.markForCheck();
          });
        } else {
          // No backend; just add locally
          this.joinedTables.push(entry);
          this.showJoinModal = false;
          this.updatePreProcessedData();
          this.toastService.showToast(`Joined "${entry.table}" (${entry.type} JOIN)`, 'success');
          this.cdr.markForCheck();
        }
      })
    );
  }

  /** Live SQL preview for the modal */
  get joinSqlPreview(): string {
    if (!this.pendingJoin.table || !this.pendingJoin.leftCol || !this.pendingJoin.rightCol) return '';
    const selectCols = (this.columns?.filter(c => c.selected).map(c => `${this.selectedTable}.${c.name}`) || []).slice(0,6).join(', ') || `${this.selectedTable}.*`;
    return `SELECT ${selectCols} FROM ${this.selectedTable} ${this.pendingJoin.type} JOIN ${this.pendingJoin.table} ON ${this.selectedTable}.${this.pendingJoin.leftCol} = ${this.pendingJoin.table}.${this.pendingJoin.rightCol} LIMIT 25`;
  }

  removeJoin(index: number) {
    this.joinedTables.splice(index, 1);
    this.results   = null;
    this.chartData = [];
    this.showChart = false;
    this.updatePreProcessedData();
    this.cdr.markForCheck();
  }

  // ── Filters ─────────────────────────────────────────────────────────────
  addFilter() {
    this.filters.push({ column: '', operator: '=', value: '' });
    this.cdr.markForCheck();
  }

  removeFilter(index: number) {
    this.filters.splice(index, 1);
    this.cdr.markForCheck();
  }

  // ── Query building (JOIN-aware) ─────────────────────────────────────────
  buildQuery(): string {
    // SELECT clause
    const primarySelected = this.columns
      .filter(c => c.selected)
      .map(c => `${this.selectedTable}.${c.name}`);

    const joinedSelected = this.joinedTables.flatMap(j =>
      j.columns.filter(c => c.selected).map(c => `${j.table}.${c.name}`)
    );

    const allSelected = [...primarySelected, ...joinedSelected];
    let selectClause = allSelected.length > 0 ? allSelected.join(', ') : `${this.selectedTable}.*`;

    // FROM + JOINs
    let fromClause = `FROM ${this.selectedTable}`;
    for (const j of this.joinedTables) {
      fromClause += ` ${j.type} JOIN ${j.table} ON ${j.condition}`;
    }

    // WHERE
    const activeFilters = this.filters.filter(f => f.column && f.value);
    let whereClause = '';
    if (activeFilters.length > 0) {
      const conditions = activeFilters.map(f => {
        const colRef = f.column.includes('.') ? f.column : `${this.selectedTable}.${f.column}`;
        return f.operator === 'contains'
          ? `${colRef} LIKE '%${f.value}%'`
          : `${colRef} ${f.operator} '${f.value}'`;
      });
      whereClause = ` WHERE ${conditions.join(' AND ')}`;
    }

    // GROUP BY
    if (this.groupBy) {
      const groupRef = this.groupBy.includes('.') ? this.groupBy : `${this.selectedTable}.${this.groupBy}`;
      const aggCol   = this.metricColumn?.includes('.')
        ? this.metricColumn
        : this.metricColumn ? `${this.selectedTable}.${this.metricColumn}` : '';

      if (this.metric === 'count') {
        selectClause = `${groupRef}, COUNT(*) AS count`;
      } else if (this.metric === 'sum' && aggCol) {
        selectClause = `${groupRef}, SUM(${aggCol}) AS sum`;
      } else if (this.metric === 'avg' && aggCol) {
        selectClause = `${groupRef}, AVG(${aggCol}) AS avg`;
      }

      return `SELECT ${selectClause} ${fromClause}${whereClause} GROUP BY ${groupRef} LIMIT 500`;
    }

    return `SELECT ${selectClause} ${fromClause}${whereClause} LIMIT 500`;
  }

  // ── Run queries ─────────────────────────────────────────────────────────
  async runQuery() {
    if (!this.selectedTable) {
      this.toastService.showToast('Please select a table', 'error');
      return;
    }

    this.loading   = true;
    this.showChart = false;
    this.cdr.markForCheck();

    const query = this.buildQuery();
    console.log('Executing query:', query);

    this.subscriptions.add(
      this.dbService.executeQuery(query, this.selectedConnection?.id).subscribe({
        next: (result) => {
          this.results = result;
          this.loading = false;
          this.updatePreProcessedData();
          this.updateChartData();

          if (this.chartType !== 'table' && result.rows?.length > 0) {
            this.showChart = true;
          }

          this.toastService.showToast(`Query returned ${result.rowCount} rows`, 'success');
          this.cdr.markForCheck();
          setTimeout(() => { this.cdr.markForCheck(); }, 100);
        },
        error: (error) => {
          console.error('Query error:', error);
          this.loading = false;
          this.toastService.showToast(`Query failed: ${error.message || 'Unknown error'}`, 'error');
          this.cdr.markForCheck();
        },
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
        },
      })
    );
  }

  // ── Chart data ──────────────────────────────────────────────────────────
  private updateChartData() {
    if (!this.results?.rows?.length) {
      this.showChart = false;
      return;
    }

    this.chartData = this.results.rows.map(row => ({ ...row }));

    if (this.chartType !== 'table') {
      if (this.groupBy) {
        const metricName = this.metric === 'count' ? 'Count'
          : this.metric === 'sum' ? 'Sum' : 'Average';
        this.chartTitle = `${metricName} by ${this.formatColumnName(this.groupBy)}`;
      } else {
        const names: { [k: string]: string } = {
          bar: 'Bar Chart', line: 'Line Chart', pie: 'Pie Chart',
          area: 'Area Chart', scatter: 'Scatter Plot',
        };
        this.chartTitle = names[this.chartType] || 'Data Visualization';
      }
    }

    const cols = this.results.columns || [];

    // X axis
    if (this.groupBy) {
      this.xAxisField = this.groupBy;
    } else {
      let xCol = cols.find(col => {
        const s = this.results?.rows[0]?.[col];
        return typeof s === 'string' && !col.toLowerCase().includes('id');
      }) ?? cols.find(col => typeof this.results?.rows[0]?.[col] === 'string')
         ?? cols[0];
      this.xAxisField = xCol;
    }

    // Y axis
    if (this.metricColumn && this.metric !== 'count') {
      this.yAxisField = this.metricColumn;
    } else {
      let yCol = cols.find(col => typeof this.results?.rows[0]?.[col] === 'number')
        ?? (cols.length > 1 ? cols[1] : cols[0]);
      this.yAxisField = yCol;
    }

    this.showChart = this.chartType !== 'table' && this.chartData.length > 0;
  }

  onChartTypeChange(newType: string) {
    if (this.renderTimeout) clearTimeout(this.renderTimeout);
    this.chartType = newType;
    this.renderTimeout = setTimeout(() => {
      this.updateChartData();
      this.cdr.markForCheck();
    }, 50);
  }

  forceChartRefresh() {
    setTimeout(() => {
      if (this.chartType !== 'table' && this.results?.rows?.length) {
        this.updateChartData();
        this.cdr.markForCheck();
      }
    }, 100);
  }

  private forceChartRender() {
    if (this.chartType !== 'table' && this.results?.rows?.length) {
      this.updateChartData();
      this.showChart = true;
      this.cdr.markForCheck();
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  inferColumnType(columnName: string): string {
    const n = columnName.toLowerCase();
    if (['id','amount','price','value','count','revenue','expenses','profit','quantity','total']
          .some(k => n.includes(k))) return 'number';
    if (['date','created_at','updated_at','signup_date'].some(k => n.includes(k))) return 'date';
    return 'string';
  }

  formatColumnName(columnName: string): string {
    return columnName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  getStatusClass(status: string): string {
    if (!status) return '';
    const s = String(status).toLowerCase();
    if (['paid','completed','active'].includes(s)) return 'status-badge paid';
    if (s === 'pending')   return 'status-badge pending';
    if (s === 'cancelled') return 'status-badge cancelled';
    return '';
  }

  trackByColumnName(_: number, item: any): string { return item?.name ?? ''; }
  trackByIndex(index: number, _: any): number     { return index; }
  trackByChartType(_: number, item: any): string  { return item?.value ?? ''; }

  // ── Save / Load saved questions ─────────────────────────────────────────
  private runQueryAfterLoad(question: any) {
    if (this.columns.length > 0) {
      question.type === 'sql' ? this.runSqlQuery() : this.runQuery();
    } else {
      setTimeout(() => this.runQueryAfterLoad(question), 200);
    }
  }

  private checkForSavedQuestion(attempt = 0) {
    const loadData = localStorage.getItem('load_question');
    if (!loadData) return;

    try {
      const question = JSON.parse(loadData);
      this.activeTab    = question.type     || 'visual';
      this.sqlQuery     = question.query    || '';
      this.selectedTable= question.table || question.tableName || '';
      this.groupBy      = question.groupBy  || '';
      this.metric       = question.metric   || 'count';
      this.metricColumn = question.metricColumn || '';

      const validChart = ['table','bar','line','pie','area','scatter'];
      this.chartType = (question.chartType && validChart.includes(question.chartType))
        ? question.chartType
        : question.type === 'visual' ? 'bar' : 'table';

      localStorage.removeItem('load_question');

      if (question.type === 'visual') {
        this.filters = Array.isArray(question.filters) ? question.filters : [];
        const selectedColumnsToApply: string[] = question.selectedColumns || [];

        const connId   = question.connectionId;
        const connName = question.connectionName;

        if (connId || connName) {
          const connsSub = this.dbService.getConnections().subscribe(conns => {
            const match = conns.find(c => (connId && c.id === connId) || (connName && c.name === connName));
            if (match) {
              this.dbService.setActiveConnection(match);
              let activeSub: Subscription | undefined;
              activeSub = this.dbService.activeConnection$.subscribe(ac => {
                if (ac && ac.id === match.id) {
                  this.selectedConnection = match;
                  this.loadTables();
                  setTimeout(() => {
                    this.selectedTable = question.table || question.tableName || this.tables[0] || '';
                    this.loadColumnsForSavedQuestion(selectedColumnsToApply);
                  }, 300);
                  activeSub?.unsubscribe();
                }
              });
              if (activeSub) this.subscriptions.add(activeSub);
            } else {
              this.fallbackLoadColumns(selectedColumnsToApply, question, attempt);
            }
          });
          this.subscriptions.add(connsSub);
        } else if (question.table || question.tableName) {
          const tableToFind = question.table || question.tableName;
          this.dbService.getAllTablesWithConnection().subscribe(list => {
            const match = list.find(x => x.tableName === tableToFind);
            if (match) {
              const connsSub = this.dbService.getConnections().subscribe(conns => {
                const conn = conns.find(c => c.id === match.connectionId);
                if (conn) {
                  this.dbService.setActiveConnection(conn);
                  this.selectedConnection = conn;
                  this.loadTables();
                  setTimeout(() => {
                    this.selectedTable = tableToFind;
                    this.loadColumnsForSavedQuestion(selectedColumnsToApply);
                  }, 300);
                }
              });
              this.subscriptions.add(connsSub);
            } else {
              this.fallbackLoadColumns(selectedColumnsToApply, question, attempt);
            }
          });
        } else {
          this.fallbackLoadColumns(selectedColumnsToApply, question, attempt);
        }
      } else if (question.type === 'sql') {
        setTimeout(() => this.runSqlQuery(), 500);
      }

      this.toastService.showToast(`Loaded: ${question.name}`, 'success');
    } catch (error) {
      console.error('Error loading question:', error);
      this.toastService.showToast('Error loading saved question', 'error');
    }
  }

  private fallbackLoadColumns(selectedColumnsToApply: string[], question: any, attempt: number) {
    if ((!this.tables || this.tables.length === 0) && attempt < 10) {
      setTimeout(() => this.checkForSavedQuestion(attempt + 1), 300);
      return;
    }
    if (this.selectedTable && this.selectedConnection) {
      this.loadColumnsForSavedQuestion(selectedColumnsToApply);
    } else {
      this.toastService.showToast('Please select a database connection first', 'error');
    }
  }

  private loadColumnsForSavedQuestion(selectedColumnsToApply: string[]) {
    const sub = this.dbService.getTableColumns(this.selectedTable, this.selectedConnection!.id).subscribe({
      next: (columnNames) => {
        const selectAll = !selectedColumnsToApply || selectedColumnsToApply.length === 0;
        this.columns = columnNames.map(name => ({
          name,
          selected: selectAll || selectedColumnsToApply.includes(name),
          type: this.inferColumnType(name),
        }));
        this.updatePreProcessedData();
        this.cdr.markForCheck();
        setTimeout(() => {
          this.runQuery();
          setTimeout(() => this.forceChartRender(), 1000);
        }, 500);
      },
      error: () => this.toastService.showToast('Error loading table columns', 'error'),
    });
    this.subscriptions.add(sub);
  }

  saveQuestion() {
    const name = prompt('Enter question name:');
    if (!name?.trim()) return;

    const selectedColumns = this.columns.filter(c => c.selected).map(c => c.name);
    const payload = {
      name:           name.trim(),
      type:           this.activeTab,
      query:          this.activeTab === 'sql' ? this.sqlQuery : this.buildQuery(),
      table:          this.selectedTable || '',
      tableName:      this.selectedTable || '',
      connectionId:   this.selectedConnection?.id,
      connectionName: this.selectedConnection?.name,
      groupBy:        this.groupBy     || undefined,
      metric:         this.metric      || undefined,
      metricColumn:   this.metricColumn|| undefined,
      chartType:      this.chartType   || undefined,
      filters:        this.filters?.length ? this.filters : undefined,
      selectedColumns:selectedColumns.length ? selectedColumns : undefined,
    };

    const token = this.authService.getToken();
    if (token) {
      this.savedQuestionsService.saveQuestion(payload).subscribe({
        next: () => {
          this.toastService.showToast(`Question "${name}" saved to server`, 'success');
          window.dispatchEvent(new CustomEvent('savedQuestionsUpdated'));
        },
        error: (err) => {
          console.error('Error saving to backend:', err);
          this.toastService.showToast('Failed to save to server, saved locally instead', 'info');
          this.saveToLocalStorage(payload);
        },
      });
    } else {
      this.saveToLocalStorage(payload);
      this.toastService.showToast(`Question "${name}" saved locally`, 'success');
    }
  }

  private saveToLocalStorage(payload: any) {
    const saved = JSON.parse(localStorage.getItem('saved_questions') || '[]');
    saved.push({ id: Date.now(), createdAt: new Date().toISOString(), ...payload });
    localStorage.setItem('saved_questions', JSON.stringify(saved));
    window.dispatchEvent(new CustomEvent('savedQuestionsUpdated'));
  }
}