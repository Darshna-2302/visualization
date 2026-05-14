import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VegaChart } from '../vega-chart/vega-chart';

interface Connection { id: number; name: string; }
interface ChartTypeOption { value: string; label: string; }

// ── Schema constants matching your actual DB column names ──────────────────
const NODE_ID_COL      = 'NodeId';
const NODE_NAME_COL    = 'NodeName';
const SENSOR_ID_COL    = 'SensorId';
const SENSOR_NAME_COL  = 'SensorName';      // the last column in your sensor table
const SENSOR_NODE_FK   = 'NodeId';          // sensor.NodeId → node.NodeId
const CHANNEL_ID_COL   = 'ChannelId';
const CHANNEL_NAME_COL = 'ChannelName';
const CHANNEL_SEN_FK   = 'SensorId';        // channel.SensorId → sensor.SensorId
const CHANNEL_DATE_COL = 'RecordedAt';
const CHANNEL_VAL_COL  = 'Value';

@Component({
  selector: 'app-visual-component',
  imports: [CommonModule, FormsModule, JsonPipe, VegaChart],
  templateUrl: './visual-component.html',
  styleUrls: ['./visual-component.css']
})
export class VisualMapperComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription = new Subscription();

  connections: Connection[] = [];
  selectedConnectionId: any = null;

  tables: string[] = [];
  selectedMainTable: string = '';
  columns: string[] = [];

  // Node flow
  nodeValues: string[] = [];                              // distinct NodeName values
  selectedNodeValue: string = '';                         // chosen NodeName
  relatedSensorsForNode: { id: any; name: string }[] = [];

  // Sensor / Channel cascades (node flow)
  selectedSensorNode: any = '';                           // chosen SensorId
  filteredChannels: { id: any; name: string }[] = [];
  selectedChannel: any = '';                              // chosen ChannelId

  // Chart
  chartTypes: ChartTypeOption[] = [
    { value: 'line',  label: 'Line Chart'   },
    { value: 'bar',   label: 'Bar Chart'    },
    { value: 'point', label: 'Scatter Plot' },
    { value: 'area',  label: 'Area Chart'   }
  ];
  chartType: string = 'line';
  chartData: any[] = [];
  xAxisField: string = '';
  yAxisField: string = '';
  chartTitle: string = '';
  errorMessage: string = '';

  // Filters section (kept for non-node tables)
  dateColumn: string = '';
  valueColumn: string = '';

  // Raw caches
  public nodeData: any[] = [];
  private sensorData: any[] = [];
  private channelData: any[] = [];

  constructor(
    private dataService: DatabaseService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.subscriptions.add(
      this.dataService.activeConnection$.subscribe(conn => {
        if (conn) {
          this.connections = [{ id: conn.id, name: conn.name }];
          this.selectedConnectionId = conn.id;
          this.dataService.getTablesForConnection(conn.id).subscribe({
            next: (tables: string[]) => { this.tables = tables; this.resetAllSelections(); },
            error: (err) => console.error('Error loading tables:', err)
          });
        } else {
          this.connections = [];
          this.selectedConnectionId = null;
          this.tables = [];
          this.resetAllSelections();
        }
      })
    );
  }

  ngOnDestroy() { this.subscriptions.unsubscribe(); }

  // ── Table selection ───────────────────────────────────────────────────────

  onMainTableChange() {
    this.resetMappingSelections();
    if (!this.selectedMainTable || !this.selectedConnectionId) return;

    this.dataService.getTableColumns(this.selectedMainTable, this.selectedConnectionId).subscribe({
      next: (cols: string[]) => {
        this.columns = cols;
        if (this.selectedMainTable === 'node') {
          this.loadNodeData();
        }
      },
      error: (err) => { console.error('Error loading columns:', err); this.errorMessage = 'Failed to load columns'; }
    });
  }

  // ── Node flow ─────────────────────────────────────────────────────────────

  private loadNodeData() {
    if (!this.selectedConnectionId) return;
    this.dataService.getTableData('node', this.selectedConnectionId).subscribe({
      next: (data: any) => {
        this.nodeData = Array.isArray(data) ? data : data.data || [];
        // Build node name dropdown from NodeName column
        this.nodeValues = [...new Set(
          this.nodeData.map(r => r[NODE_NAME_COL]).filter(v => v != null)
        )] as string[];
      },
      error: (err) => console.error('Error loading node data:', err)
    });
  }

  onSelectedNodeInstanceChange() {
    // Reset downstream
    this.selectedSensorNode = '';
    this.selectedChannel = '';
    this.relatedSensorsForNode = [];
    this.filteredChannels = [];
    this.chartData = [];

    if (!this.selectedNodeValue || !this.selectedConnectionId) return;

    // Find the NodeId for the chosen NodeName
    const nodeRow = this.nodeData.find(r => r[NODE_NAME_COL] === this.selectedNodeValue);
    const nodeId = nodeRow ? nodeRow[NODE_ID_COL] : null;
    if (nodeId == null) {
      this.errorMessage = 'Could not resolve NodeId for selected node.';
      return;
    }

    // Fetch sensors where sensor.NodeId = nodeId
    this.dataService.getRowsByColumnValue('sensor', SENSOR_NODE_FK, String(nodeId), this.selectedConnectionId).subscribe({
      next: (rows: any) => {
        this.sensorData = Array.isArray(rows) ? rows : [];
        this.relatedSensorsForNode = this.sensorData.map(s => ({
          id: s[SENSOR_ID_COL],
          name: s[SENSOR_NAME_COL] || `Sensor ${s[SENSOR_ID_COL]}`
        }));
        if (this.relatedSensorsForNode.length === 0) {
          this.errorMessage = '';   // clear — the template shows its own "No sensors" message
        }
      },
      error: (err) => {
        console.error('Error loading sensors for node:', err);
        this.relatedSensorsForNode = [];
      }
    });
  }

 
onSelectedSensorNodeChange() {
  // Reset downstream
  this.selectedChannel = '';
  this.filteredChannels = [];
  this.chartData = [];

  if (!this.selectedSensorNode || !this.selectedConnectionId) return;

  // Fetch ALL channel rows for this sensor — we cache them for chart use too
  this.dataService.getRowsByColumnValue(
    'channel', CHANNEL_SEN_FK, String(this.selectedSensorNode), this.selectedConnectionId
  ).subscribe({
    next: (rows: any) => {
      this.channelData = Array.isArray(rows) ? rows : [];

      // Build unique channel options from the fetched rows
      const seen = new Set<string>();
      this.filteredChannels = this.channelData
        .filter(ch => {
          const key = String(ch[CHANNEL_ID_COL]);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(ch => ({
          id: ch[CHANNEL_ID_COL],
          name: ch[CHANNEL_NAME_COL] || `Channel ${ch[CHANNEL_ID_COL]}`
        }));
    },
    error: (err) => {
      console.error('Error loading channels for sensor:', err);
      this.filteredChannels = [];
    }
  });
}

onSelectedChannelChange() {
  this.chartData = [];
  if (!this.selectedChannel) return;

  // No extra HTTP call needed — filter the already-fetched channelData cache
  // selectedChannel holds a ChannelId (number or string); compare loosely
  const rows = this.channelData.filter(
    ch => String(ch[CHANNEL_ID_COL]) === String(this.selectedChannel)
  );

  if (!rows.length) {
    this.errorMessage = 'No data found for selected channel.';
    return;
  }

  this.dateColumn  = CHANNEL_DATE_COL;
  this.valueColumn = CHANNEL_VAL_COL;

  this.chartData = rows
    .map(r => ({
      [CHANNEL_DATE_COL]: r[CHANNEL_DATE_COL],
      [CHANNEL_VAL_COL]:  Number(r[CHANNEL_VAL_COL])
    }))
    .filter(r => r[CHANNEL_DATE_COL] != null && !isNaN(r[CHANNEL_VAL_COL]));

  this.xAxisField = CHANNEL_DATE_COL;
  this.yAxisField = CHANNEL_VAL_COL;

  const sensorLabel  = this.relatedSensorsForNode.find(
    s => String(s.id) === String(this.selectedSensorNode)
  )?.name || String(this.selectedSensorNode);

  const channelLabel = this.filteredChannels.find(
    c => String(c.id) === String(this.selectedChannel)
  )?.name || String(this.selectedChannel);

  this.chartTitle   = `${this.selectedNodeValue} › ${sensorLabel} › ${channelLabel}`;
  this.errorMessage = '';

  // Trigger chart render
  this.loadAndVisualize();
}
  // ── Visualization ─────────────────────────────────────────────────────────

  isVisualizationReady(): boolean {
    if (this.selectedMainTable === 'node') {
      return !!(this.selectedConnectionId && this.chartData && this.chartData.length > 0);
    }
    return !!(this.selectedConnectionId && this.selectedMainTable && this.dateColumn && this.valueColumn);
  }

  loadAndVisualize() {
    if (!this.isVisualizationReady()) {
      this.errorMessage = 'Please complete all selections before loading.';
      return;
    }
    this.errorMessage = '';
    // chartData is already populated by onSelectedChannelChange; just ensure axis fields are set
    this.xAxisField = this.dateColumn  || CHANNEL_DATE_COL;
    this.yAxisField = this.valueColumn || CHANNEL_VAL_COL;
  }

  buildVisualization(): any {
    return {
      connectionId:  this.selectedConnectionId,
      mainTable:     this.selectedMainTable,
      node:          this.selectedNodeValue,
      sensorId:      this.selectedSensorNode,
      channelId:     this.selectedChannel,
      dateColumn:    this.dateColumn,
      valueColumn:   this.valueColumn,
      chartType:     this.chartType
    };
  }

  resetSelections() { this.resetAllSelections(); }

  private resetAllSelections() {
    this.selectedMainTable    = '';
    this.columns              = [];
    this.resetMappingSelections();
  }

  private resetMappingSelections() {
    this.nodeValues           = [];
    this.selectedNodeValue    = '';
    this.relatedSensorsForNode = [];
    this.selectedSensorNode   = '';
    this.filteredChannels     = [];
    this.selectedChannel      = '';
    this.dateColumn           = '';
    this.valueColumn          = '';
    this.chartData            = [];
    this.errorMessage         = '';
    this.nodeData             = [];
    this.sensorData           = [];
    this.channelData          = [];
  }
}