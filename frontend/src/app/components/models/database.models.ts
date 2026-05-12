export interface DatabaseConnection {
  lastRefreshed: Date;
  tables: any;
  id: number;
  name: string;
  type: string;
  server: string;
  database: string;
  username?: string;
  password?: string;
  port?: string;
  status: 'Connected' | 'Disconnected' | 'Error';
  builtin?: boolean;
}

export interface TableData {
  name: string;
  columns: string[];
  rows: any[];
  totalRows: number;
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  executionTime: number;
  rowCount: number;
}