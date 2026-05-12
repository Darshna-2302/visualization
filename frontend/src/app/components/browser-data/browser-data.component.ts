import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { DatabaseService } from '../../services/database.service';
import { ToastService } from '../../services/toast.service';
import { DatabaseConnection } from '../../components/models/database.models';

@Component({
  selector: 'app-browse-data',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './browser-data.component.html',
  styleUrls: ['./browser-data.component.css']
})
export class BrowseDataComponent implements OnInit, OnDestroy {
  activeConnection: DatabaseConnection | null = null;
  tables: string[] = [];
  selectedTable: string = '';
  tableData: any[] = [];
  tableColumns: string[] = [];
  searchTerm: string = '';
  currentPage: number = 1;
  pageSize: number = 10;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  loading: boolean = false;
  isLoadingTables: boolean = false;
  
  private subscriptions: Subscription = new Subscription();
  
  constructor(
    private dbService: DatabaseService,
    private toastService: ToastService,
    public cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit() {
    this.subscriptions.add(
      this.dbService.activeConnection$.subscribe(connection => {
        console.log('Active connection changed:', connection);
        this.activeConnection = connection;
        if (connection) {
          this.loadTables();
        } else {
          this.tables = [];
          this.selectedTable = '';
          this.tableData = [];
          this.tableColumns = [];
          this.cdr.detectChanges();
        }
      })
    );
  }
  
  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
  
  loadTables() {
    if (this.activeConnection && this.activeConnection.id) {
      this.isLoadingTables = true;
      this.loading = true;
      this.tables = [];
      this.cdr.detectChanges();
console.log('Active connection:', this.activeConnection);
      console.log('Loading tables for connection ID:', this.activeConnection.id);
      
      this.subscriptions.add(
        this.dbService.getTablesForConnection(this.activeConnection.id).subscribe({
          next: (tables) => {
            console.log('Tables received:', tables);
            console.log('Tables length:', tables.length);
            
            // Create a new array reference to trigger change detection
            this.tables = [...tables];
            this.isLoadingTables = false;
            this.loading = false;
            
            console.log('Tables after assignment:', this.tables);
            console.log('Tables length after assignment:', this.tables.length);
            
            // Force change detection
            this.cdr.detectChanges();
            
            if (this.tables.length > 0 && !this.selectedTable) {
              console.log('Auto-selecting first table:', this.tables[0]);
              this.selectTable(this.tables[0]);
            } else if (this.tables.length === 0) {
              this.toastService.showToast('No tables found in this database', 'info');
              this.cdr.detectChanges();
            }
          },
          error: (error) => {
            console.error('Error loading tables:', error);
            this.isLoadingTables = false;
            this.loading = false;
            this.tables = [];
            this.cdr.detectChanges();
            this.toastService.showToast('Failed to load tables', 'error');
          }
        })
      );
    } else {
      console.warn('No active connection or connection ID missing');
      this.tables = [];
      this.isLoadingTables = false;
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
  
  selectTable(table: string) {
    console.log('Selecting table:', table);
    this.selectedTable = table;
    this.currentPage = 1;
    this.searchTerm = '';
    this.sortColumn = '';
    this.cdr.detectChanges();
    this.loadTableData();
  }
  
  loadTableData() {
console.log('Active connection:', this.activeConnection);
    if (this.selectedTable && this.activeConnection?.id) {
      this.loading = true;
      this.tableData = [];
      this.tableColumns = [];
      this.cdr.detectChanges();
      
      console.log('Loading data for table:', this.selectedTable);
      console.log('Using connection ID:', this.activeConnection.id);
      // Use executeQuery to fetch columns and rows together so keys match the column names
      const q = `SELECT * FROM ${this.selectedTable} LIMIT 100`;
      this.subscriptions.add(
        this.dbService.executeQuery(q, this.activeConnection.id).subscribe({
          next: (result) => {
            console.log('ExecuteQuery result columns:', result.columns);
            console.log('ExecuteQuery result rows:', result.rows?.length);
            this.tableColumns = [...(result.columns || [])];
            this.tableData = [...(result.rows || [])];
            this.loading = false;
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error executing query for table data:', error);
            // Fallback to separate fetches
            this.dbService.getTableData(this.selectedTable, this.activeConnection!.id).subscribe({
              next: (data) => {
                this.tableData = [...(data || [])];
                this.loading = false;
                this.cdr.detectChanges();
              },
              error: (err) => {
                console.error('Fallback getTableData failed:', err);
                this.tableData = [];
                this.loading = false;
                this.cdr.detectChanges();
                this.toastService.showToast(`Failed to load data from ${this.selectedTable}`, 'error');
              }
            });
            this.dbService.getTableColumns(this.selectedTable, this.activeConnection!.id).subscribe({
              next: (columns) => {
                this.tableColumns = [...(columns || [])];
                this.cdr.detectChanges();
              },
              error: (err) => {
                console.error('Fallback getTableColumns failed:', err);
                this.tableColumns = [];
                this.cdr.detectChanges();
              }
            });
          }
        })
      );
    } else {
      console.warn('Cannot load table data: missing table name or connection ID');
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
  
  getFilteredAndSortedData(): any[] {
    if (!this.tableData || this.tableData.length === 0) {
      return [];
    }
    
    let data = [...this.tableData];
    
    // Filter
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      data = data.filter(row => 
        Object.values(row).some(val => 
          val !== null && val !== undefined && String(val).toLowerCase().includes(term)
        )
      );
    }
    
    // Sort
    if (this.sortColumn && this.tableColumns.includes(this.sortColumn)) {
      data.sort((a, b) => {
        let aVal = a[this.sortColumn];
        let bVal = b[this.sortColumn];
        
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const comparison = String(aVal).localeCompare(String(bVal));
        return this.sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    
    // Paginate
    const start = (this.currentPage - 1) * this.pageSize;
    return data.slice(start, start + this.pageSize);
  }
  
  get totalPages(): number {
    if (!this.tableData || this.tableData.length === 0) return 1;
    
    let data = [...this.tableData];
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      data = data.filter(row => 
        Object.values(row).some(val => 
          val !== null && val !== undefined && String(val).toLowerCase().includes(term)
        )
      );
    }
    return Math.ceil(data.length / this.pageSize) || 1;
  }
  
  get totalRows(): number {
    if (!this.tableData || this.tableData.length === 0) return 0;
    
    let data = [...this.tableData];
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      data = data.filter(row => 
        Object.values(row).some(val => 
          val !== null && val !== undefined && String(val).toLowerCase().includes(term)
        )
      );
    }
    return data.length;
  }
  
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.cdr.detectChanges();
  }
  
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.cdr.detectChanges();
    }
  }
  
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.cdr.detectChanges();
    }
  }
  
  refreshData() {
    this.toastService.showToast('Refreshing data...', 'info');
    this.loadTableData();
    this.loadTables();
  }
  
  getSortIcon(column: string): string {
    if (this.sortColumn !== column) return 'unfold_more';
    return this.sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }
  
  getStatusClass(value: any): string {
    if (!value) return '';
    const statusLower = String(value).toLowerCase();
    
    if (statusLower === 'paid' || statusLower === 'completed' || statusLower === 'active' || statusLower === 'connected') {
      return 'status-badge paid';
    }
    if (statusLower === 'pending') {
      return 'status-badge pending';
    }
    if (statusLower === 'cancelled' || statusLower === 'disconnected') {
      return 'status-badge cancelled';
    }
    if (statusLower === 'inactive') {
      return 'status-badge inactive';
    }
    return '';
  }
  
  hasTables(): boolean {
    return this.tables && this.tables.length > 0;
  }
  
  reloadTables() {
    console.log('Manually reloading tables...');
    this.loadTables();
  }
}