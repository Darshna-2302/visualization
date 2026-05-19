import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VegaChart } from '../vega-chart/vega-chart';

interface Connection { id: number; name: string; }
interface ChartTypeOption { value: string; label: string; }
interface VegaDataPoint {
  date: any;
  value: number;
  series: string;
  channelId: any;
}

const NODE_ID_COL      = 'NodeId';
const NODE_NAME_COL    = 'NodeName';
const SENSOR_ID_COL    = 'SensorId';
const SENSOR_NAME_COL  = 'SensorName';
const SENSOR_NODE_FK   = 'NodeId';
const CHANNEL_ID_COL   = 'ChannelId';
const CHANNEL_NAME_COL = 'ChannelName';
const CHANNEL_SEN_FK   = 'SensorId';
const DETAIL_TABLE     = 'detail';
const DETAIL_CHAN_FK   = 'ChannelId';
const CHANNEL_DATE_COL = 'CreatedAt';
const CHANNEL_VAL_COL  = 'Value';

const EXCLUDE_COL_PATTERNS: RegExp[] = [
  /id$/i, /name$/i, /^createdat$/i, /^updatedat$/i, /^recordedat$/i,
  /^date$/i, /^time$/i, /description$/i, /^label$/i, /^type$/i,
  /^status$/i, /^key$/i, /^code$/i, /^slug$/i, /^uuid$/i, /^guid$/i,
];

function getCol(row: any, colName: string): any {
  if (!row || !colName) return undefined;
  if (row[colName] !== undefined) return row[colName];
  const lower = colName.toLowerCase();
  const key = Object.keys(row).find(k => k.toLowerCase() === lower);
  return key !== undefined ? row[key] : undefined;
}

function normaliseTables(raw: any): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : Object.keys(raw);
  return arr
    .map((t: any) => (typeof t === 'string' ? t.trim() : String(t).trim()))
    .filter((t: string) => t.length > 0);
}

function isExcludedColumn(col: string): boolean {
  return EXCLUDE_COL_PATTERNS.some(p => p.test(col));
}

export interface ChannelState {
  id: any;
  name: string;
  checked: boolean;
  columns: string[];
  selectedColumn: string;
  loading: boolean;
  error: string;
  /**
   * FIX: Stable color index assigned once when the channel list loads.
   * Previously the template used the *loop index i* which changes depending
   * on whether you're iterating channelStates (all) or checkedChannels (subset).
   * The same channel got different colors in the dropdown vs the Y-axis picker.
   * Now every color lookup goes through ch.colorIndex, which never changes.
   */
  colorIndex: number;
}

export interface ChartSeries {
  channelId: any;
  channelName: string;
  yField: string;
  data: any[];
}

@Component({
  selector: 'app-visual-component',
  imports: [CommonModule, FormsModule, VegaChart],
  templateUrl: './visual-component.html',
  styleUrls: ['./visual-component.css']
})
export class VisualMapperComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription = new Subscription();

  connections: Connection[] = [];
  selectedConnectionId: any = null;
  chartData: VegaDataPoint[] = [];
  tables: string[] = [];
  selectedMainTable: string = '';
  columns: string[] = [];

  nodeValues: string[] = [];
  selectedNodeValue: string = '';
  relatedSensorsForNode: { id: any; name: string }[] = [];
  selectedSensorNode: any = '';
  channelStates: ChannelState[] = [];

  loadingNodes    = false;
  loadingSensors  = false;
  loadingChannels = false;

  chartTypes: ChartTypeOption[] = [
    { value: 'line',  label: 'Line Chart'   },
    { value: 'bar',   label: 'Bar Chart'    },
    { value: 'point', label: 'Scatter Plot' },
    { value: 'area',  label: 'Area Chart'   }
  ];
  chartType: string = 'line';
  chartSeries: ChartSeries[] = [];
  yAxisFields: string[] = [];
  xAxisField: string = CHANNEL_DATE_COL;
  chartTitle: string = '';
  errorMessage: string = '';

  public  nodeData:   any[] = [];
  private sensorData: any[] = [];

  channelDropdownOpen = false;

  private readonly COLORS = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
  ];
  private readonly LIGHT_COLORS = [
    '#e3f2fd', '#fff3e0', '#e8f5e9', '#ffebee', '#f3e5f5',
    '#efebe9', '#fce4ec', '#f5f5f5', '#f9fbe7', '#e0f7fa'
  ];

  constructor(
    private dataService: DatabaseService,
    private authService: AuthService,
    private elRef: ElementRef
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.channelDropdownOpen &&
        !this.elRef.nativeElement.contains(event.target)) {
      this.channelDropdownOpen = false;
    }
  }

  ngOnInit() {
    this.subscriptions.add(
      this.dataService.activeConnection$.subscribe(conn => {
        if (conn) {
          this.connections          = [{ id: conn.id, name: conn.name }];
          this.selectedConnectionId = conn.id;
          this.dataService.getTablesForConnection(conn.id).subscribe({
            next: (raw: any) => {
              this.tables = normaliseTables(raw);
              this.resetAllSelections();
            },
            error: (err) => console.error('Error loading tables:', err)
          });
        } else {
          this.connections          = [];
          this.selectedConnectionId = null;
          this.tables               = [];
          this.resetAllSelections();
        }
      })
    );
  }

  ngOnDestroy() { this.subscriptions.unsubscribe(); }

  // ─────────────────────────────────────────────────────────────────────────
  // Color helpers — accept colorIndex (from ch.colorIndex), not loop index i
  // ─────────────────────────────────────────────────────────────────────────

  getChannelColor(colorIndex: number): string {
    return this.COLORS[colorIndex % this.COLORS.length];
  }

  getChannelColorLight(colorIndex: number): string {
    return this.LIGHT_COLORS[colorIndex % this.LIGHT_COLORS.length];
  }

  getSensorName(sensorId: any): string {
    return this.relatedSensorsForNode.find(s => String(s.id) === String(sensorId))?.name ?? String(sensorId);
  }

  get checkedChannels(): ChannelState[] {
    return this.channelStates.filter(c => c.checked);
  }

  get checkedChannelCount(): number {
    return this.channelStates.filter(c => c.checked).length;
  }

  get channelDropdownLabel(): string {
    const n = this.checkedChannelCount;
    if (n === 0) return '-- select channel(s) --';
    if (n === 1) return this.checkedChannels[0].name;
    return `${n} channels selected`;
  }

  toggleChannelDropdown() {
    this.channelDropdownOpen = !this.channelDropdownOpen;
  }

  closeChannelDropdown() {
    this.channelDropdownOpen = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Table selection
  // ─────────────────────────────────────────────────────────────────────────

  onMainTableChange() {
    this.resetMappingSelections();
    if (!this.selectedMainTable || !this.selectedConnectionId) return;

    this.dataService.getTableColumns(this.selectedMainTable, this.selectedConnectionId).subscribe({
      next: (cols: string[]) => {
        this.columns = Array.isArray(cols) ? cols : [];
        if (this.selectedMainTable.toLowerCase() === 'node') {
          this.loadNodeData();
        }
      },
      error: (err) => {
        console.error('Error loading columns:', err);
        this.errorMessage = 'Failed to load columns for table.';
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Node
  // ─────────────────────────────────────────────────────────────────────────

  private loadNodeData() {
    if (!this.selectedConnectionId) return;
    this.loadingNodes = true;

    this.dataService.getTableData('node', this.selectedConnectionId).subscribe({
      next: (data: any) => {
        this.loadingNodes = false;
        this.nodeData = Array.isArray(data) ? data : (data?.rows ?? data?.data ?? []);
        this.nodeValues = [
          ...new Set(
            this.nodeData
              .map(r => getCol(r, NODE_NAME_COL))
              .filter(v => v != null && v !== '')
          )
        ] as string[];
      },
      error: (err) => {
        this.loadingNodes = false;
        console.error('Error loading node data:', err);
        this.errorMessage = 'Failed to load node list.';
      }
    });
  }

  onSelectedNodeInstanceChange() {
    this.selectedSensorNode    = '';
    this.channelStates         = [];
    this.relatedSensorsForNode = [];
    this.chartSeries           = [];
    this.chartData             = [];
    this.errorMessage          = '';

    if (!this.selectedNodeValue || !this.selectedConnectionId) return;

    const nodeRow = this.nodeData.find(
      r => String(getCol(r, NODE_NAME_COL)) === String(this.selectedNodeValue)
    );
    const nodeId = nodeRow ? getCol(nodeRow, NODE_ID_COL) : null;

    if (nodeId == null) {
      this.errorMessage = `Could not resolve NodeId for "${this.selectedNodeValue}".`;
      return;
    }

    this.loadingSensors = true;
    this.dataService.getRowsByColumnValue(
      'sensor', SENSOR_NODE_FK, String(nodeId), this.selectedConnectionId
    ).subscribe({
      next: (rows: any) => {
        this.loadingSensors = false;
        this.sensorData = Array.isArray(rows) ? rows : [];
        this.relatedSensorsForNode = this.sensorData
          .map(s => ({
            id:   getCol(s, SENSOR_ID_COL),
            name: getCol(s, SENSOR_NAME_COL) ?? `Sensor ${getCol(s, SENSOR_ID_COL)}`
          }))
          .filter(s => s.id != null);
      },
      error: (err) => {
        this.loadingSensors = false;
        this.relatedSensorsForNode = [];
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sensor → load channels
  // FIX: Assign stable colorIndex to each channel at load time.
  // ─────────────────────────────────────────────────────────────────────────

  onSelectedSensorNodeChange() {
    this.channelStates = [];
    this.chartSeries   = [];
    this.chartData     = [];
    this.errorMessage  = '';

    if (!this.selectedSensorNode || !this.selectedConnectionId) return;

    this.loadingChannels = true;
    this.dataService.getRowsByColumnValue(
      'channel', CHANNEL_SEN_FK, String(this.selectedSensorNode), this.selectedConnectionId
    ).subscribe({
      next: (rows: any) => {
        this.loadingChannels = false;
        const channelRows = Array.isArray(rows) ? rows : [];
        const seen = new Set<string>();
        let colorIdx = 0;

        this.channelStates = channelRows
          .map(ch => ({
            id:             getCol(ch, CHANNEL_ID_COL),
            name:           getCol(ch, CHANNEL_NAME_COL) ?? `Channel ${getCol(ch, CHANNEL_ID_COL)}`,
            checked:        false,
            columns:        [],
            selectedColumn: '',
            loading:        false,
            error:          '',
            colorIndex:     -1  // will be set after dedup
          }))
          .filter(ch => {
            if (ch.id == null) return false;
            const key = String(ch.name).trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map(ch => ({ ...ch, colorIndex: colorIdx++ }));
      },
      error: (err) => {
        this.loadingChannels = false;
        this.channelStates   = [];
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Channel checkbox toggled
  // ─────────────────────────────────────────────────────────────────────────

  onChannelToggle(state: ChannelState, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    state.checked = isChecked;

    if (state.checked) {
      if (state.columns.length === 0 && !state.loading) {
        // First selection: load columns + data, then build series
        this.loadChannelColumns(state);
      } else if (state.columns.length > 0) {
        // FIX: Re-checking a previously unchecked channel.
        // rebuildChartFromStates() alone won't work here because the series
        // was removed from chartSeries when the channel was unchecked.
        // We must re-fetch the data and re-add the series.
        this.reloadSeriesForChannel(state);
      }
    } else {
      this.rebuildChartFromStates();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX: Reload series for a channel whose columns are already known but whose
  // series was removed from chartSeries when it was unchecked.
  // ─────────────────────────────────────────────────────────────────────────
  private reloadSeriesForChannel(state: ChannelState) {
    state.loading = true;
    state.error   = '';

    this.dataService.getRowsByColumnValue(
      DETAIL_TABLE, DETAIL_CHAN_FK, String(state.id), this.selectedConnectionId
    ).subscribe({
      next: (rows: any) => {
        state.loading = false;
        const detailRows = Array.isArray(rows) ? rows : [];
        if (!detailRows.length) {
          state.error = 'No data in detail table for this channel.';
          return;
        }
        this.buildSeriesForChannel(state, detailRows);
      },
      error: (err) => {
        state.loading = false;
        state.error   = 'Failed to load detail data.';
      }
    });
  }

  private loadChannelColumns(state: ChannelState) {
    state.loading = true;
    state.error   = '';

    this.dataService.getRowsByColumnValue(
      DETAIL_TABLE, DETAIL_CHAN_FK, String(state.id), this.selectedConnectionId
    ).subscribe({
      next: (rows: any) => {
        state.loading = false;
        const detailRows = Array.isArray(rows) ? rows : [];

        if (!detailRows.length) {
          state.error = 'No data in detail table for this channel.';
          return;
        }

        const allCols = Object.keys(detailRows[0]);
        const sample  = detailRows.slice(0, 50);

        let cols = allCols.filter(col => {
          if (isExcludedColumn(col)) return false;
          return sample.some(r => {
            const v = r[col];
            if (v === null || v === undefined || v === '') return false;
            const num = Number(v);
            return !isNaN(num) && isFinite(num);
          });
        });

        if (cols.length === 0) {
          cols = allCols.filter(col => !isExcludedColumn(col));
        }

        state.columns        = cols;
        state.selectedColumn = cols.find(c => c.toLowerCase() === CHANNEL_VAL_COL.toLowerCase()) ?? cols[0] ?? '';

        this.buildSeriesForChannel(state, detailRows);
      },
      error: (err) => {
        state.loading = false;
        state.error   = 'Failed to load detail data.';
        console.error('[VisualBuilder] loadChannelColumns error', err);
      }
    });
  }

  onChannelColumnChange(state: ChannelState) {
    if (!state.checked || !state.selectedColumn) return;

    state.loading = true;
    this.dataService.getRowsByColumnValue(
      DETAIL_TABLE, DETAIL_CHAN_FK, String(state.id), this.selectedConnectionId
    ).subscribe({
      next: (rows: any) => {
        state.loading = false;
        const detailRows = Array.isArray(rows) ? rows : [];
        this.buildSeriesForChannel(state, detailRows);
      },
      error: (err) => {
        state.loading = false;
        state.error   = 'Failed to reload detail data.';
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Series / chart building
  // ─────────────────────────────────────────────────────────────────────────

  private buildSeriesForChannel(state: ChannelState, detailRows: any[]) {
    const col = state.selectedColumn;
    const series: ChartSeries = {
      channelId:   state.id,
      channelName: state.name,
      yField:      col,
      data: detailRows
        .map(r => ({
          [CHANNEL_DATE_COL]: getCol(r, CHANNEL_DATE_COL),
          value:              Number(getCol(r, col)),
          series:             state.name
        }))
        .filter(r => r[CHANNEL_DATE_COL] != null && !isNaN(r['value']))
    };

    const idx = this.chartSeries.findIndex(s => String(s.channelId) === String(state.id));
    if (idx >= 0) {
      this.chartSeries[idx] = series;
    } else {
      this.chartSeries.push(series);
    }

    this.rebuildChartFromStates();
  }

  private rebuildChartFromStates() {
    const checkedIds = new Set(this.checkedChannels.map(c => String(c.id)));
    this.chartSeries = this.chartSeries.filter(s => checkedIds.has(String(s.channelId)));

    this.chartData = this.chartSeries.flatMap(s => {
      const ch = this.channelStates.find(c => String(c.id) === String(s.channelId));
      return s.data.map(row => ({
        ...row,
        _series:     s.channelName,
        _yField:     s.yField,
        _colorIndex: ch?.colorIndex ?? 0,
        value:       row.value !== undefined ? row.value : row[s.yField]
      }));
    });

    // All unique y-fields across all active series.
    // The HTML passes the full yAxisFields array to the chart (not just [0]).
    this.yAxisFields = [...new Set(this.chartSeries.map(s => s.yField))];
    this.xAxisField  = CHANNEL_DATE_COL;

    const sensorLabel = this.getSensorName(this.selectedSensorNode);
    const channelList = this.checkedChannels.map(c => c.name).join(', ');
    this.chartTitle   = channelList
      ? `${this.selectedNodeValue} › ${sensorLabel} › ${channelList}`
      : 'Multi-Channel Chart';

    this.errorMessage = '';

    if (this.isVisualizationReady()) this.loadAndVisualize();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Visualize
  // ─────────────────────────────────────────────────────────────────────────

  isVisualizationReady(): boolean {
    return !!(this.selectedConnectionId && this.chartData?.length > 0);
  }

  loadAndVisualize() {
    if (!this.isVisualizationReady()) {
      this.errorMessage = 'Please select at least one channel with data.';
      return;
    }
    this.errorMessage = '';
  }

  buildVisualization(): any {
    return {
      connectionId: this.selectedConnectionId,
      mainTable:    this.selectedMainTable,
      node:         this.selectedNodeValue,
      sensorId:     this.selectedSensorNode,
      channels:     this.checkedChannels.map(c => ({ id: c.id, name: c.name, column: c.selectedColumn })),
      chartType:    this.chartType
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX: selectAllChannels — removed the premature rebuildChartFromStates()
  // call that ran before any async data loaded, giving an empty chart.
  // Each async callback (loadChannelColumns / reloadSeriesForChannel) already
  // calls rebuildChartFromStates() when its data arrives.
  // ─────────────────────────────────────────────────────────────────────────
  selectAllChannels() {
    this.channelStates.forEach(c => {
      if (!c.checked) {
        c.checked = true;
        if (c.columns.length === 0 && !c.loading) {
          this.loadChannelColumns(c);
        } else if (c.columns.length > 0) {
          this.reloadSeriesForChannel(c);
        }
      }
    });
    // No rebuildChartFromStates() here — fires from each async callback
  }

  clearAllChannels() {
    this.channelStates.forEach(c => { c.checked = false; });
    this.chartSeries = [];
    this.rebuildChartFromStates();
  }

  resetSelections() { this.resetAllSelections(); }

  private resetAllSelections() {
    this.selectedMainTable = '';
    this.columns           = [];
    this.resetMappingSelections();
  }

  private resetMappingSelections() {
    this.nodeValues            = [];
    this.selectedNodeValue     = '';
    this.relatedSensorsForNode = [];
    this.selectedSensorNode    = '';
    this.channelStates         = [];
    this.chartSeries           = [];
    this.chartData             = [];
    this.yAxisFields           = [];
    this.errorMessage          = '';
    this.nodeData              = [];
    this.sensorData            = [];
    this.loadingNodes          = false;
    this.loadingSensors        = false;
    this.loadingChannels       = false;
    this.channelDropdownOpen   = false;
  }
}