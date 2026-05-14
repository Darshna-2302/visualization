import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VegaChart } from '../vega-chart/vega-chart';

interface Connection { id: number; name: string; }
interface ChartTypeOption { value: string; label: string; }

// ── Exact DB column names (PascalCase as defined in your MySQL schema) ─────
const NODE_ID_COL      = 'NodeId';
const NODE_NAME_COL    = 'NodeName';
const SENSOR_ID_COL    = 'SensorId';
const SENSOR_NAME_COL  = 'SensorName';   // last column in sensor table
const SENSOR_NODE_FK   = 'NodeId';       // sensor.NodeId → node.NodeId
const CHANNEL_ID_COL   = 'ChannelId';
const CHANNEL_NAME_COL = 'ChannelName';
const CHANNEL_SEN_FK   = 'SensorId';     // channel.SensorId → sensor.SensorId
const CHANNEL_DATE_COL = 'RecordedAt';
const CHANNEL_VAL_COL  = 'Value';

/**
 * Case-insensitive column accessor.
 * MySQL/.NET drivers sometimes return 'nodeid' instead of 'NodeId'.
 * This handles all casing variants so nothing breaks.
 */
function getCol(row: any, colName: string): any {
  if (!row || !colName) return undefined;
  if (row[colName] !== undefined) return row[colName];          // exact match
  const lower = colName.toLowerCase();
  const key = Object.keys(row).find(k => k.toLowerCase() === lower);
  return key !== undefined ? row[key] : undefined;
}

/** Safely normalise the table list returned by the API */
function normaliseTables(raw: any): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : Object.keys(raw);
  return arr
    .map((t: any) => (typeof t === 'string' ? t.trim() : String(t).trim()))
    .filter((t: string) => t.length > 0);
}

@Component({
  selector: 'app-visual-component',
  imports: [CommonModule, FormsModule, JsonPipe, VegaChart],
  templateUrl: './visual-component.html',
  styleUrls: ['./visual-component.css']
})
export class VisualMapperComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription = new Subscription();

  // ── Connection ────────────────────────────────────────────────────────────
  connections: Connection[] = [];
  selectedConnectionId: any = null;

  // ── Tables ────────────────────────────────────────────────────────────────
  tables: string[] = [];
  selectedMainTable: string = '';
  columns: string[] = [];

  // ── Node → Sensor → Channel cascade ─────────────────────────────────────
  nodeValues: string[] = [];                              // NodeName list
  selectedNodeValue: string = '';                         // chosen NodeName

  relatedSensorsForNode: { id: any; name: string }[] = [];
  selectedSensorNode: any = '';                           // chosen SensorId

  filteredChannels: { id: any; name: string }[] = [];
  selectedChannel: any = '';                              // chosen ChannelId

  // ── Loading flags (guards "no data" messages against showing too early) ──
  loadingNodes    = false;
  loadingSensors  = false;
  loadingChannels = false;

  // ── Chart ─────────────────────────────────────────────────────────────────
  chartTypes: ChartTypeOption[] = [
    { value: 'line',  label: 'Line Chart'   },
    { value: 'bar',   label: 'Bar Chart'    },
    { value: 'point', label: 'Scatter Plot' },
    { value: 'area',  label: 'Area Chart'   }
  ];
  chartType: string  = 'line';
  chartData: any[]   = [];
  xAxisField: string = '';
  yAxisField: string = '';
  chartTitle: string = '';
  errorMessage: string = '';

  dateColumn: string  = '';
  valueColumn: string = '';

  // ── Raw data caches ───────────────────────────────────────────────────────
  public  nodeData:    any[] = [];
  private sensorData:  any[] = [];
  private channelData: any[] = [];

  constructor(
    private dataService: DatabaseService,
    private authService: AuthService
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit() {
    this.subscriptions.add(
      this.dataService.activeConnection$.subscribe(conn => {
        if (conn) {
          this.connections        = [{ id: conn.id, name: conn.name }];
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
  // Node → load node names into dropdown
  // ─────────────────────────────────────────────────────────────────────────

  private loadNodeData() {
    if (!this.selectedConnectionId) return;
    this.loadingNodes = true;

    this.dataService.getTableData('node', this.selectedConnectionId).subscribe({
      next: (data: any) => {
        this.loadingNodes = false;
        // Handle { data: [] }, { rows: [] }, or plain []
        this.nodeData = Array.isArray(data)
          ? data
          : (data?.rows ?? data?.data ?? []);

        this.nodeValues = [
          ...new Set(
            this.nodeData
              .map(r => getCol(r, NODE_NAME_COL))
              .filter(v => v != null && v !== '')
          )
        ] as string[];

        if (this.nodeValues.length === 0) {
          console.warn(
            `[VisualBuilder] No values found for column "${NODE_NAME_COL}". ` +
            `Keys in first row:`, Object.keys(this.nodeData[0] ?? {})
          );
        }
      },
      error: (err) => {
        this.loadingNodes = false;
        console.error('Error loading node data:', err);
        this.errorMessage = 'Failed to load node list.';
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Node selected → load its sensors
  // ─────────────────────────────────────────────────────────────────────────

  onSelectedNodeInstanceChange() {
    // Reset all downstream state
    this.selectedSensorNode    = '';
    this.selectedChannel       = '';
    this.relatedSensorsForNode = [];
    this.filteredChannels      = [];
    this.chartData             = [];
    this.errorMessage          = '';
    this.loadingSensors        = false;
    this.loadingChannels       = false;

    if (!this.selectedNodeValue || !this.selectedConnectionId) return;

    // Resolve NodeId from the cached node list
    const nodeRow = this.nodeData.find(
      r => String(getCol(r, NODE_NAME_COL)) === String(this.selectedNodeValue)
    );
    const nodeId = nodeRow ? getCol(nodeRow, NODE_ID_COL) : null;

    if (nodeId == null) {
      this.errorMessage =
        `Could not resolve NodeId for "${this.selectedNodeValue}". ` +
        `Check NODE_ID_COL constant matches your DB column name.`;
      console.warn('[VisualBuilder] nodeData sample:', this.nodeData[0]);
      return;
    }

    // ── Fetch sensors where sensor.NodeId = nodeId ────────────────────────
    this.loadingSensors = true;   // ← set BEFORE request so template shows "Loading sensors..."

    this.dataService.getRowsByColumnValue(
      'sensor', SENSOR_NODE_FK, String(nodeId), this.selectedConnectionId
    ).subscribe({
      next: (rows: any) => {
        this.loadingSensors = false;  // ← clear AFTER response
        this.sensorData = Array.isArray(rows) ? rows : [];

        this.relatedSensorsForNode = this.sensorData
          .map(s => ({
            id:   getCol(s, SENSOR_ID_COL),
            name: getCol(s, SENSOR_NAME_COL) ?? `Sensor ${getCol(s, SENSOR_ID_COL)}`
          }))
          .filter(s => s.id != null);

        if (this.relatedSensorsForNode.length === 0) {
          console.warn(
            `[VisualBuilder] No sensors for NodeId=${nodeId} via column "${SENSOR_NODE_FK}". ` +
            `Keys in first sensor row:`, Object.keys(this.sensorData[0] ?? {})
          );
        }
      },
      error: (err) => {
        this.loadingSensors = false;
        console.error('Error loading sensors:', err);
        this.relatedSensorsForNode = [];
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sensor selected → load its channels
  // ─────────────────────────────────────────────────────────────────────────

  onSelectedSensorNodeChange() {
    // Reset downstream
    this.selectedChannel  = '';
    this.filteredChannels = [];
    this.chartData        = [];
    this.errorMessage     = '';
    this.loadingChannels  = false;

    if (!this.selectedSensorNode || !this.selectedConnectionId) return;

    // ── Fetch channels where channel.SensorId = selectedSensorNode ────────
    this.loadingChannels = true;  // ← set BEFORE request

    this.dataService.getRowsByColumnValue(
      'channel', CHANNEL_SEN_FK, String(this.selectedSensorNode), this.selectedConnectionId
    ).subscribe({
      next: (rows: any) => {
        this.loadingChannels = false;   // ← clear AFTER response
        this.channelData = Array.isArray(rows) ? rows : [];

        const seen = new Set<string>();
        this.filteredChannels = this.channelData
          .filter(ch => {
            const key = String(getCol(ch, CHANNEL_ID_COL));
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map(ch => ({
            id:   getCol(ch, CHANNEL_ID_COL),
            name: getCol(ch, CHANNEL_NAME_COL) ?? `Channel ${getCol(ch, CHANNEL_ID_COL)}`
          }))
          .filter(ch => ch.id != null);

        if (this.filteredChannels.length === 0) {
          console.warn(
            `[VisualBuilder] No channels for SensorId=${this.selectedSensorNode} ` +
            `via column "${CHANNEL_SEN_FK}". ` +
            `Keys in first channel row:`, Object.keys(this.channelData[0] ?? {})
          );
        }
      },
      error: (err) => {
        this.loadingChannels = false;
        console.error('Error loading channels:', err);
        this.filteredChannels = [];
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Channel selected → build chart data from cache
  // ─────────────────────────────────────────────────────────────────────────

  onSelectedChannelChange() {
    this.chartData    = [];
    this.errorMessage = '';
    if (!this.selectedChannel) return;

    // Filter the already-cached channelData — no extra HTTP call needed.
    // Use String() comparison to handle number/string type mismatch.
    const rows = this.channelData.filter(
      ch => String(getCol(ch, CHANNEL_ID_COL)) === String(this.selectedChannel)
    );

    if (!rows.length) {
      this.errorMessage = 'No data found for selected channel.';
      return;
    }

    this.dateColumn  = CHANNEL_DATE_COL;
    this.valueColumn = CHANNEL_VAL_COL;

    this.chartData = rows
      .map(r => ({
        [CHANNEL_DATE_COL]: getCol(r, CHANNEL_DATE_COL),
        [CHANNEL_VAL_COL]:  Number(getCol(r, CHANNEL_VAL_COL))
      }))
      .filter(r => r[CHANNEL_DATE_COL] != null && !isNaN(r[CHANNEL_VAL_COL]));

    this.xAxisField = CHANNEL_DATE_COL;
    this.yAxisField = CHANNEL_VAL_COL;

    const sensorLabel = this.relatedSensorsForNode.find(
      s => String(s.id) === String(this.selectedSensorNode)
    )?.name ?? String(this.selectedSensorNode);

    const channelLabel = this.filteredChannels.find(
      c => String(c.id) === String(this.selectedChannel)
    )?.name ?? String(this.selectedChannel);

    this.chartTitle   = `${this.selectedNodeValue} › ${sensorLabel} › ${channelLabel}`;
    this.errorMessage = '';

    if (this.isVisualizationReady()) this.loadAndVisualize();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Visualize
  // ─────────────────────────────────────────────────────────────────────────

  isVisualizationReady(): boolean {
    if (this.selectedMainTable.toLowerCase() === 'node') {
      return !!(this.selectedConnectionId && this.chartData?.length > 0);
    }
    return !!(
      this.selectedConnectionId &&
      this.selectedMainTable &&
      this.dateColumn &&
      this.valueColumn
    );
  }

  loadAndVisualize() {
    if (!this.isVisualizationReady()) {
      this.errorMessage = 'Please complete all selections before loading.';
      return;
    }
    this.errorMessage = '';
    // chartData already populated by onSelectedChannelChange; just confirm axis fields
    this.xAxisField = this.dateColumn  || CHANNEL_DATE_COL;
    this.yAxisField = this.valueColumn || CHANNEL_VAL_COL;
  }

  buildVisualization(): any {
    return {
      connectionId: this.selectedConnectionId,
      mainTable:    this.selectedMainTable,
      node:         this.selectedNodeValue,
      sensorId:     this.selectedSensorNode,
      channelId:    this.selectedChannel,
      dateColumn:   this.dateColumn,
      valueColumn:  this.valueColumn,
      chartType:    this.chartType
    };
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
    this.filteredChannels      = [];
    this.selectedChannel       = '';
    this.dateColumn            = '';
    this.valueColumn           = '';
    this.chartData             = [];
    this.errorMessage          = '';
    this.nodeData              = [];
    this.sensorData            = [];
    this.channelData           = [];
    this.loadingNodes          = false;
    this.loadingSensors        = false;
    this.loadingChannels       = false;
  }
}