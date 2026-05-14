import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:5182/api'; // Update to the actual backend port

  constructor(private http: HttpClient, private authService: AuthService) { }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    });
  }

  // Database Connections
  getConnections(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/DbConnection`, { headers: this.getHeaders() });
  }

  createConnection(config: any): Observable<any> {
    const payload = { ...config };
    if (payload.type && !payload.provider && !payload.Provider) {
      payload.Provider = payload.type;
    }
    return this.http.post(`${this.baseUrl}/DbConnection`, payload, { headers: this.getHeaders() });
  }

  testConnection(config: any): Observable<any> {
    const payload = { ...config };
    if (payload.type && !payload.provider && !payload.Provider) {
      payload.Provider = payload.type;
    }
    return this.http.post(`${this.baseUrl}/DbConnection/test`, payload, { headers: this.getHeaders() });
  }

  deleteConnection(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/DbConnection/${id}`, { headers: this.getHeaders() });
  }

  // Queries
  runQuery(connectionId: number, query: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/Query/run`, { connectionId, query }, { headers: this.getHeaders() });
  }

  // Metadata
  getTables(connectionId: number): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/Query/tables/${connectionId}`, { headers: this.getHeaders() });
  }

  getColumns(connectionId: number, tableName: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/Query/columns/${connectionId}/${encodeURIComponent(tableName)}`, { headers: this.getHeaders() });
  }

  getDistinctValues(connectionId: number, tableName: string, columnName: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/Query/distinct/${connectionId}/${encodeURIComponent(tableName)}/${encodeURIComponent(columnName)}`, { headers: this.getHeaders() });
  }

  getRowsByColumnValue(connectionId: number, tableName: string, columnName: string, value: string): Observable<any[]> {
    // value passed as query string to avoid path encoding issues
    return this.http.get<any[]>(`${this.baseUrl}/Query/filter/${connectionId}/${encodeURIComponent(tableName)}/${encodeURIComponent(columnName)}?value=${encodeURIComponent(value)}`, { headers: this.getHeaders() });
  }

  getSensorsByNode(connectionId: number, sensorJoinColumn: string, nodeJoinColumn: string, value: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/Query/sensors-by-node/${connectionId}/${encodeURIComponent(sensorJoinColumn)}/${encodeURIComponent(nodeJoinColumn)}?value=${encodeURIComponent(value)}`, { headers: this.getHeaders() });
  }
}
