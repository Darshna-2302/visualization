import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, map, tap, delay } from 'rxjs/operators';
import { DatabaseConnection, QueryResult } from '../components/models/database.models';
import { ApiService } from './api';
import { AuthService } from './auth';

const CONNECTIONS_KEY = 'biapp_connections';
const SCHEMAS_KEY = 'biapp_schemas';
const ACTIVE_ID_KEY = 'biapp_active_id';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private connections: DatabaseConnection[] = [];
  private schemas: { [connId: number]: { [tableName: string]: any[] } } = {};
  private activeConnectionSubject = new BehaviorSubject<DatabaseConnection | null>(null);
  activeConnection$ = this.activeConnectionSubject.asObservable();

  private readonly BUILTIN_CONNECTIONS: DatabaseConnection[] = [
    { id:1, name:'Production DB',     type:'PostgreSQL', server:'db.prod.internal',   database:'prod_db',       status:'Connected', tables:['orders','customers','products','revenue','inventory','shipments','returns'], builtin: true, lastRefreshed: new Date() },
    { id:2, name:'E-commerce Logs',   type:'MySQL',      server:'192.168.1.45',        database:'ecom_logs',     status:'Connected', tables:['transactions','users','products'], builtin: true, lastRefreshed: new Date() },
    { id:3, name:'Marketing Replica', type:'PostgreSQL', server:'mkt-replica.aws.com', database:'marketing_db',  status:'Connected', tables:['campaigns','leads','analytics'], builtin: true, lastRefreshed: new Date() },
    { id:4, name:'Archived Sales',    type:'MySQL',      server:'archive-sql-01',      database:'sales_archive', status:'Connected', tables:['sales_2023','sales_2024'], builtin: true, lastRefreshed: new Date() }
  ];

  private readonly BUILTIN_SCHEMAS: { [connId: number]: { [t: string]: any[] } } = {
    1: {
      orders:    [{ id:1, customer_name:'Alice Johnson', product:'Pro Plan',   amount:299, status:'paid',    created_at:'2024-01-05' },
                  { id:2, customer_name:'Bob Smith',     product:'Basic Plan', amount:99,  status:'paid',    created_at:'2024-01-08' },
                  { id:3, customer_name:'Carol White',   product:'Enterprise', amount:999, status:'pending', created_at:'2024-01-12' }],
      customers: [{ id:1, name:'Alice Johnson', email:'alice@example.com', country:'USA', plan:'pro'  },
                  { id:2, name:'Bob Smith',     email:'bob@example.com',   country:'UK',  plan:'free' }],
      products:  [{ id:1, name:'Basic Plan', category:'Subscription', price:99,  stock:999 },
                  { id:2, name:'Pro Plan',   category:'Subscription', price:299, stock:999 }],
      revenue:   [{ month:'Jan', revenue:18200, expenses:11000, profit:7200 },
                  { month:'Feb', revenue:21500, expenses:12500, profit:9000 }],
      inventory: [{ sku:'A100', name:'Pro Plan', stock:500, location:'WH1' },
                  { sku:'B200', name:'Basic Plan', stock:1200, location:'WH2' }],
      shipments: [{ id:1, order_id:1, carrier:'UPS', status:'delivered', shipped_at:'2024-01-06' },
                  { id:2, order_id:3, carrier:'FedEx', status:'in_transit', shipped_at:'2024-01-13' }],
      returns:   [{ id:1, order_id:2, reason:'damaged', refunded:99, date:'2024-01-10' }]
    },
    2: {
      transactions:[{ id:1, user_id:1, amount:299, status:'completed', date:'2024-01-05' },
                    { id:2, user_id:2, amount:99,  status:'completed', date:'2024-01-08' }],
      users:       [{ id:1, name:'John Doe',   email:'john@example.com', created_at:'2023-01-01' },
                    { id:2, name:'Jane Smith', email:'jane@example.com', created_at:'2023-01-02' }],
      products:    [{ id:1, name:'Product A', price:49.99, stock:100 },
                    { id:2, name:'Product B', price:99.99, stock:50  }]
    },
    3: {
      campaigns: [{ id:1, name:'Summer Sale',  budget:5000, roi:2.5, status:'active'    },
                  { id:2, name:'Winter Promo', budget:3000, roi:1.8, status:'completed' }],
      leads:     [{ id:1, name:'Acme Corp',    source:'Website',  score:85, status:'qualified' },
                  { id:2, name:'TechStart Inc',source:'Referral', score:92, status:'contacted' }],
      analytics: [{ id:1, metric:'Page Views', value:15000, date:'2024-01-01' },
                  { id:2, metric:'Conversions',value:450,   date:'2024-01-01' }]
    },
    4: {
      sales_2023:[{ id:1, product:'Product A', amount:1000, quarter:'Q1' },
                  { id:2, product:'Product B', amount:1500, quarter:'Q2' }],
      sales_2024:[{ id:1, product:'Product A', amount:1200, quarter:'Q1' },
                  { id:2, product:'Product B', amount:1800, quarter:'Q1' }]
    }
  };



  constructor(private apiService: ApiService, private authService: AuthService) {
    this.init();



    // Listen for auth changes: when user logs in, fetch backend connections; when logs out, clear user-owned cache
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        // Fetch authoritative list from backend for the current user
        this.apiService.getConnections().subscribe(
          conns => {
            this.connections = conns;
            this._saveConnections();
          },
          () => {
            // ignore errors here; keep local cache as fallback
          }
        );
      } else {
        // On logout, remove any user-owned connections from local cache (keep built-ins)
        const builtInIds = new Set(this.BUILTIN_CONNECTIONS.map(c => c.id));
        this.connections = this.connections.filter(c => builtInIds.has(c.id) || c.builtin);
        // Remove any persisted schemas for non-builtins
        const newSchemas: { [connId: number]: { [tableName: string]: any[] } } = {};
        for (const id of Object.keys(this.schemas)) {
          const numId = Number(id);
          if (builtInIds.has(numId)) newSchemas[numId] = this.schemas[numId];
        }
        this.schemas = newSchemas;
        this._saveConnections();
        this._saveSchemas();
        // Reset active connection
        this.activeConnectionSubject.next(null);
        localStorage.removeItem(ACTIVE_ID_KEY);
      }
    });
  }

  private init() {
    const storedConns = localStorage.getItem(CONNECTIONS_KEY);
    const storedSchemas = localStorage.getItem(SCHEMAS_KEY);

    if (storedConns) {
      this.connections = JSON.parse(storedConns);
      const userSchemas = storedSchemas ? JSON.parse(storedSchemas) : {};
      // Always layer built-in schemas on top (they are not persisted)
      this.schemas = { ...userSchemas };
      for (const id of Object.keys(this.BUILTIN_SCHEMAS)) {
        const numId = Number(id);
        this.schemas[numId] = { ...this.BUILTIN_SCHEMAS[numId] };
      }
    } else {
      this.connections = JSON.parse(JSON.stringify(this.BUILTIN_CONNECTIONS));
      this.schemas = JSON.parse(JSON.stringify(this.BUILTIN_SCHEMAS));
      this._saveConnections();
      // Don't persist built-in schemas — they are always recreated
    }

    const savedId = localStorage.getItem(this.getActiveKey());
    if (savedId) {
      const conn = this.connections.find(c => c.id === Number(savedId));
      if (conn) this.activeConnectionSubject.next(conn);
    }
  }

  private getActiveKey(): string {
    const username = this.authService.getUsername() || 'anon';
    return `${ACTIVE_ID_KEY}_${username}`;
  }

  private _saveConnections() {
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(this.connections));
  }

  /** Only persist schemas for user-created connections (built-ins are always recreated) */
  private _saveSchemas() {
    const builtInIds = new Set(this.BUILTIN_CONNECTIONS.map(c => c.id));
    const userSchemas: { [k: number]: any } = {};
    for (const id of Object.keys(this.schemas)) {
      const numId = Number(id);
      if (!builtInIds.has(numId)) {
        userSchemas[numId] = this.schemas[numId];
      }
    }
    localStorage.setItem(SCHEMAS_KEY, JSON.stringify(userSchemas));
  }

  private _nextId(): number {
    return this.connections.length > 0 ? Math.max(...this.connections.map(c => c.id)) + 1 : 1;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getConnections(): Observable<DatabaseConnection[]> {
    // Try backend first; fall back to local built-ins on error
    return this.apiService.getConnections().pipe(
      tap(conns => { this.connections = conns; this._saveConnections(); }),
      catchError(() => of([...this.connections]))
    );
  }

  addConnection(connection: Partial<DatabaseConnection>): Observable<DatabaseConnection> {
    const id = this._nextId();
    const tables = ['sample_table_1', 'sample_table_2', 'sample_table_3'];
    const newConn: DatabaseConnection = {
      ...(connection as DatabaseConnection),
      id,
      status: 'Connected',
      tables,
      builtin: false
    };
    this.schemas[id] = {
      sample_table_1: [
        { id:1, name:'Row A', category:'Alpha', value:120, status:'active',   created_at:'2024-01-01' },
        { id:2, name:'Row B', category:'Beta',  value:240, status:'inactive', created_at:'2024-01-02' },
        { id:3, name:'Row C', category:'Alpha', value:180, status:'active',   created_at:'2024-01-03' },
        { id:4, name:'Row D', category:'Gamma', value:90,  status:'active',   created_at:'2024-01-04' }
      ],
      sample_table_2: [
        { id:1, ref_id:1, label:'Entry 1', amount:500,  quantity:10, date:'2024-01-01' },
        { id:2, ref_id:2, label:'Entry 2', amount:300,  quantity:5,  date:'2024-01-02' },
        { id:3, ref_id:3, label:'Entry 3', amount:800,  quantity:20, date:'2024-01-03' },
        { id:4, ref_id:4, label:'Entry 4', amount:150,  quantity:3,  date:'2024-01-04' }
      ],
      sample_table_3: [
        { id:1, month:'Jan', total:1000, average:250, region:'North' },
        { id:2, month:'Feb', total:1500, average:375, region:'South' },
        { id:3, month:'Mar', total:800,  average:200, region:'East'  },
        { id:4, month:'Apr', total:2000, average:500, region:'West'  }
      ]
    };
    // Try to create on backend; fall back to local
    return this.apiService.createConnection(connection).pipe(
      map((created: any) => {
        this.connections.push(created);
        this._saveConnections();
        return created as DatabaseConnection;
      }),
      catchError(() => {
        this.connections.push(newConn);
        this._saveConnections();
        this._saveSchemas();
        return of(newConn);
      })
    );
  }

  deleteConnection(id: number): Observable<boolean> {
    // Prevent deleting built-in connections
    const local = this.connections.find(c => c.id === id);
    if (local?.builtin) return of(false).pipe(delay(80));

    // Try to delete on backend first; fall back to local-only deletion
    return this.apiService.deleteConnection(id).pipe(
      map(() => {
        // remove locally
        this.connections = this.connections.filter(c => c.id !== id);
        delete this.schemas[id];
        this._saveConnections();
        this._saveSchemas();
        if (this.activeConnectionSubject.value?.id === id) {
          this.activeConnectionSubject.next(null);
          localStorage.removeItem(ACTIVE_ID_KEY);
        }
        return true;
      }),
      catchError(() => {
        // fallback to local removal if backend not available
        this.connections = this.connections.filter(c => c.id !== id);
        delete this.schemas[id];
        this._saveConnections();
        this._saveSchemas();
        if (this.activeConnectionSubject.value?.id === id) {
          this.activeConnectionSubject.next(null);
          localStorage.removeItem(ACTIVE_ID_KEY);
        }
        return of(true);
      })
    );
  }

  updateConnection(id: number, updates: Partial<DatabaseConnection>): Observable<DatabaseConnection> {
    const idx = this.connections.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.connections[idx] = { ...this.connections[idx], ...updates };
      this._saveConnections();
      return of(this.connections[idx]).pipe(delay(150));
    }
    return of(null as any);
  }

  testConnection(_connection: Partial<DatabaseConnection>): Observable<boolean> {
    return this.apiService.testConnection(_connection).pipe(
      map((res: any) => !!(res && res.success=== true)),
      catchError(() => of(false))
    );
  }

  setActiveConnection(connection: DatabaseConnection | null): void {
    this.activeConnectionSubject.next(connection);
    if (connection) {
      localStorage.setItem(this.getActiveKey(), String(connection.id));
    } else {
      localStorage.removeItem(this.getActiveKey());
    }
  }

  getActiveConnection(): DatabaseConnection | null {
    return this.activeConnectionSubject.value;
  }

  getTablesForConnection(connectionId: number): Observable<string[]> {
    // Prefer backend metadata but fall back to local schema/tables
    return this.apiService.getTables(connectionId).pipe(
      tap(tables => {
        // update local cache when backend returns tables
        const conn = this.connections.find(c => c.id === connectionId);
        if (conn) { conn.tables = tables; this._saveConnections(); }
      }),
      catchError(() => {
        const schema = this.schemas[connectionId];
        if (schema) return of(Object.keys(schema));
        const conn = this.connections.find(c => c.id === connectionId);
        return of(conn?.tables || []);
      })
    );
  }

  /** All tables across all connections for the multi-table picker */
  getAllTablesWithConnection(): Observable<{ connectionId: number; connectionName: string; tableName: string }[]> {
    const result: { connectionId: number; connectionName: string; tableName: string }[] = [];
    for (const conn of this.connections) {
      const schema = this.schemas[conn.id];
      const tables = schema ? Object.keys(schema) : (conn.tables || []);
      for (const t of tables) {
        result.push({ connectionId: conn.id, connectionName: conn.name, tableName: t });
      }
    }
    return of(result).pipe(delay(100));
  }

  getTableData(tableName: string, connectionId?: number): Observable<any[]> {
    // Prefer backend data for a specific connection; fallback to local schema only on error
    if (connectionId != null) {
      const q = `SELECT * FROM ${tableName} LIMIT 100`;
      return this.apiService.runQuery(connectionId, q).pipe(
        map((res: any) => res?.rows || []),
        catchError(() => {
          // fallback to local cache if API fails
          const schema = this.schemas[connectionId];
          if (schema && schema[tableName]) return of([...schema[tableName]]);
          return of([]);
        })
      );
    }

    // No connectionId specified: return local schema if available
    for (const conn of this.connections) {
      const schema = this.schemas[conn.id];
      if (schema?.[tableName]) return of([...schema[tableName]]).pipe(delay(100));
    }
    return of([]).pipe(delay(100));
  }

  getDistinctValues(tableName: string, columnName: string, connectionId?: number): Observable<any[]> {
    const connId = connectionId ?? this.activeConnectionSubject.value?.id ?? null;
    if (connId != null) {
      // Prefer backend API
      return this.apiService.getDistinctValues(connId, tableName, columnName).pipe(
        // normalize values: API may return objects like { ColumnName: value }
        map((vals: any[]) => {
          if (!Array.isArray(vals)) return [];
          return vals.map(v => {
            if (v == null) return v;
            if (typeof v === 'object') {
              const arr = Object.values(v);
              return arr.length === 1 ? arr[0] : v;
            }
            return v;
          });
        }),
        catchError(() => {
          // fallback to local cache only if API fails
          const schema = this.schemas[connId];
          if (schema && schema[tableName]) {
            const vals = [...new Set(schema[tableName].map((r: any) => r[columnName]).filter((v: any) => v != null))];
            return of(vals);
          }
          return of([]);
        })
      );
    }
    return of([]);
  }

  getRowsByColumnValue(tableName: string, columnName: string, value: string, connectionId?: number): Observable<any[]> {
    const connId = connectionId ?? this.activeConnectionSubject.value?.id ?? null;
    if (connId != null) {
      // Prefer backend API
      return this.apiService.getRowsByColumnValue(connId, tableName, columnName, value).pipe(
        catchError(() => {
          // fallback to local cache only if API fails
          const schema = this.schemas[connId];
          if (schema && schema[tableName]) {
            const rows = schema[tableName].filter((r: any) => String(r[columnName]) === String(value));
            return of(rows);
          }
          return of([]);
        })
      );
    }
    return of([]);
  }

  getSensorsByNode(sensorJoinColumn: string, nodeJoinColumn: string, nodeValue: string, connectionId?: number): Observable<any[]> {
    const connId = connectionId ?? this.activeConnectionSubject.value?.id ?? null;
    if (connId != null) {
      return this.apiService.getSensorsByNode(connId, sensorJoinColumn, nodeJoinColumn, nodeValue).pipe(
        catchError(() => {
          // fallback: attempt to load sensor table and client-filter by matching any column to nodeValue
          const schema = this.schemas[connId];
          if (schema && schema['sensor']) {
            const rows = schema['sensor'].filter((r: any) => Object.values(r).some((v: any) => String(v) === String(nodeValue)));
            return of(rows);
          }
          return of([]);
        })
      );
    }
    return of([]);
  }

  getTableColumns(tableName: string, connectionId?: number): Observable<string[]> {
    // If connectionId provided prefer backend columns metadata first
    if (connectionId != null) {
      return this.apiService.getColumns(connectionId, tableName).pipe(
        catchError(() => {
          const schema = this.schemas[connectionId];
          if (schema?.[tableName]?.length > 0) return of(Object.keys(schema[tableName][0]));
          const conn = this.connections.find(c => c.id === connectionId);
          return of([]);
        })
      );
    }

    const conns = this.connections;
    for (const conn of conns) {
      const schema = this.schemas[conn.id];
      if (schema?.[tableName]?.length > 0) {
        return of(Object.keys(schema[tableName][0])).pipe(delay(80));
      }
    }
    return of([]).pipe(delay(80));
  }

  /** Merge rows from multiple tables by a shared join key */
  mergeTableData(
    sources: { connectionId: number; tableName: string }[],
    joinKey: string
  ): Observable<any[]> {
    if (sources.length === 0) return of([]);

    const allData = sources.map(s => {
      const schema = this.schemas[s.connectionId];
      return { rows: schema?.[s.tableName] ?? [], tableName: s.tableName };
    });

    if (sources.length === 1) return of([...allData[0].rows]);

    // Full outer merge: start with first table rows, attach columns from others
    const merged = allData[0].rows.map(row => ({ ...row }));
    for (let i = 1; i < allData.length; i++) {
      const other = allData[i];
      const idx: { [k: string]: any } = {};
      for (const r of other.rows) {
        if (r[joinKey] != null) idx[String(r[joinKey])] = r;
      }
      const prefix = other.tableName.replace(/[^a-zA-Z0-9]/g, '_') + '__';
      for (const mRow of merged) {
        const keyVal = mRow[joinKey] != null ? String(mRow[joinKey]) : null;
        const match = keyVal ? idx[keyVal] : null;
        if (match) {
          for (const [k, v] of Object.entries(match)) {
            if (k !== joinKey) mRow[prefix + k] = v;
          }
        }
      }
    }
    return of(merged).pipe(delay(200));
  }

  executeQuery(query: string, connectionId?: number): Observable<QueryResult> {
    const connId = connectionId ?? this.activeConnectionSubject.value?.id ?? null;
    if (connId != null) {
      return this.apiService.runQuery(connId, query).pipe(
        map((res: any) => ({
          columns: res?.columns || [],
          rows: res?.rows || [],
          executionTime: res?.executionTime ?? res?.executionTimeMs ?? 0,
          rowCount: res?.rowCount ?? (res?.rows ? res.rows.length : 0)
        } as QueryResult)),
        catchError(() => this._localExecuteQuery(query))
      );
    }
    return this._localExecuteQuery(query);
  }

  private _localExecuteQuery(query: string): Observable<QueryResult> {
    const match = query.match(/FROM\s+(\w+)/i);
    const tableName = match ? match[1] : '';
    let data: any[] = [];
    for (const conn of this.connections) {
      const schema = this.schemas[conn.id];
      if (schema?.[tableName]) { data = [...schema[tableName]]; break; }
    }
    const whereMatch = query.match(/WHERE\s+(\w+)\s*=\s*['"]?(\w+)['"]?/i);
    if (whereMatch && data.length > 0) {
      const [, col, val] = whereMatch;
      data = data.filter(row => String(row[col]) === val);
    }
    return of({
      columns: data.length > 0 ? Object.keys(data[0]) : [],
      rows: data,
      executionTime: Math.random() * 60 + 15,
      rowCount: data.length
    }).pipe(delay(300));
  }

 refreshConnectionTables(connectionId: number): Observable<string[]> {
  console.log('Refreshing tables for connection ID:', connectionId);
  
  // First try to get from API
  return this.apiService.getTables(connectionId).pipe(
    tap(tables => {
      console.log('Tables from API refresh:', tables);
      
      // Update local cache
      const conn = this.connections.find(c => c.id === connectionId);
      if (conn) {
        conn.tables = tables;
        conn.lastRefreshed = new Date();
        this._saveConnections();
        console.log(`Updated connection ${conn.name} with ${tables.length} tables`);
      }
      
      // Update local schema if needed
      if (!this.schemas[connectionId]) {
        this.schemas[connectionId] = {};
      }
      
      // Ensure tables exist in schema
      tables.forEach(table => {
        if (!this.schemas[connectionId][table]) {
          this.schemas[connectionId][table] = [
            { id: 1, name: `Sample data for ${table}`, created_at: new Date().toISOString() }
          ];
        }
      });
      this._saveSchemas();
    }),
    catchError((error) => {
      console.error('Error refreshing tables from API:', error);
      
      // Fallback to local schema
      const schema = this.schemas[connectionId];
      if (schema) {
        const tables = Object.keys(schema);
        console.log('Tables from local schema:', tables);
        
        // Update connection with local tables
        const conn = this.connections.find(c => c.id === connectionId);
        if (conn) {
          conn.tables = tables;
          this._saveConnections();
        }
        
        return of(tables);
      }
      
      const conn = this.connections.find(c => c.id === connectionId);
      const tables = conn?.tables || [];
      console.log('Tables from connection cache:', tables);
      return of(tables);
    })
  );
}
}