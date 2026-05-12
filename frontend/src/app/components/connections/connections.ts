import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DatabaseService } from '../../services/database.service';
import { Toast, ToastService } from '../../services/toast.service';
import { DatabaseConnection } from '../../components/models/database.models';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './connections.html',
  styleUrls: ['./connections.css']
})
export class ConnectionsComponent implements OnInit, OnDestroy {
  connections: DatabaseConnection[] = [];
  toasts: Toast[] = [];
  activeConnectionId: number | null = null;
  activeConnection:number =0;
  isLoading: boolean = false;
  private subscriptions: Subscription = new Subscription();
  
  newConnection: Partial<DatabaseConnection> = {
    name: '',
    type: 'PostgreSQL',
    server: '',
    port: '5432',
    database: '',
    username: '',
    password: '',
    status: 'Disconnected',
    tables: []
  };
  showPassword: boolean = false;
  
  constructor(
    private dbService: DatabaseService,
    private toastService: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit() {
    // Load connections immediately
    this.loadConnections();
    
    // Subscribe to toasts
    this.subscriptions.add(
      this.toastService.getToasts().subscribe(toasts => {
        this.toasts = toasts;
        this.cdr.detectChanges();
      })
    );
    
    // Subscribe to active connection changes
    this.subscriptions.add(
      this.dbService.activeConnection$.subscribe(conn => {
        this.activeConnectionId = conn?.id || null;
         if(this.activeConnectionId!==null)
          {
            this.activeConnection=1;
          }       
        this.cdr.detectChanges();
      })

      
      
    );
    
   
    // Restore active connection on page load
    const savedConnection = this.dbService.getActiveConnection();
    if (savedConnection) {
      this.activeConnectionId = savedConnection.id;
      this.activeConnection=1;
      console.log('Restored active connection:', savedConnection);
    }
  }
  
  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
  
  loadConnections() {
    this.isLoading = true;
    console.log('Loading connections from API...');
    
    this.subscriptions.add(
      this.dbService.getConnections().subscribe({
        next: (conns) => {
          console.log('Connections loaded:', conns);
          console.log('Number of connections:', conns?.length || 0);
          
          // Create a new array reference to trigger change detection
          this.connections = conns ? [...conns] : [];
          
          // Log table counts for debugging
          this.connections.forEach(conn => {
            console.log(`Connection "${conn.name}" has ${conn.tables?.length || 0} tables`);
            if (conn.tables && conn.tables.length > 0) {
              console.log(`  Tables: ${conn.tables.join(', ')}`);
            }
          });
          
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading connections:', error);
          this.toastService.showToast('Failed to load connections', 'error');
          this.connections = [];
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }
  
  getTotalTables(): number {
    if (!this.connections || this.connections.length === 0) return 0;
    
    const total = this.connections.reduce((total, conn) => {
      const tableCount = conn.tables?.length || 0;
      return total + tableCount;
    }, 0);
    
    console.log('Total tables across all connections:', total);
    return total;
  }

    getActiveConnectionTables(): number {
    if (!this.activeConnectionId) return 0;
    const activeConn = this.connections.find(c => c.id === this.activeConnectionId);
    return activeConn?.tables?.length || 0;
  }
  
  getConnectionColor(type: string): string {
    const colors: { [key: string]: string } = {
      'PostgreSQL': 'linear-gradient(135deg, #336791 0%, #2d5a7a 100%)',
      'MySQL': 'linear-gradient(135deg, #00758f 0%, #005c6e 100%)',
      'SQL Server': 'linear-gradient(135deg, #cc2927 0%, #a31e1c 100%)',
      'MongoDB': 'linear-gradient(135deg, #47A248 0%, #2e6b2f 100%)',
      'BigQuery': 'linear-gradient(135deg, #4285F4 0%, #1a56c2 100%)',
      'Snowflake': 'linear-gradient(135deg, #29B5E8 0%, #1a7d9e 100%)',
      'Redshift': 'linear-gradient(135deg, #FF9900 0%, #cc7a00 100%)'
    };
    return colors[type] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }
  
  getConnectionIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'PostgreSQL': 'database',
      'MySQL': 'storage',
      'SQL Server': 'data_object',
      'MongoDB': 'leaf',
      'BigQuery': 'cloud',
      'Snowflake': 'ac_unit',
      'Redshift': 'cloud_queue'
    };
    return icons[type] || 'database';
  }
  
  getTableCount(connection: DatabaseConnection): number {
    const count = connection.tables?.length || 0;
    return count;
  }
  
  hasTables(connection: DatabaseConnection): boolean {
    return (connection.tables && connection.tables.length > 0);
  }
  
  scrollToForm() {
    document.getElementById('new-connection-form')?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  }
  
  testConnection() {
    if (!this.newConnection.server || !this.newConnection.database) {
      this.toastService.showToast('Please fill in server and database fields', 'error');
      return;
    }
    
    this.isLoading = true;
    this.subscriptions.add(
      this.dbService.testConnection(this.newConnection).subscribe({
        next: (success:boolean) => {
          this.isLoading = false;
          if (success) {
            this.toastService.showToast('Connection successful!', 'success');
          } else {
            this.toastService.showToast('Connection failed! Please check your credentials', 'error');
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.isLoading = false;
          this.toastService.showToast('Connection test failed', 'error');
          this.cdr.detectChanges();
        }
      })
    );
  }
  
  saveConnection() {
    if (!this.newConnection.name || !this.newConnection.server || !this.newConnection.database) {
      this.toastService.showToast('Please fill in all required fields (Name, Server, Database)', 'error');
      return;
    }
    
    this.isLoading = true;
    console.log('Saving new connection:', this.newConnection);
    
    this.subscriptions.add(
      this.dbService.addConnection(this.newConnection as DatabaseConnection).subscribe({
        next: (newConn) => {
          console.log('Connection saved successfully:', newConn);
          this.isLoading = false;
          this.toastService.showToast(`Connection "${newConn.name}" saved successfully!`, 'success');
          
          // Reload connections to get the updated list
          this.loadConnections();
          this.resetForm();
          
          // Auto-select the new connection after a short delay
          setTimeout(() => {
            this.setActiveConnection(newConn);
          }, 500);
          
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error saving connection:', error);
          this.isLoading = false;
          this.toastService.showToast('Failed to save connection', 'error');
          this.cdr.detectChanges();
        }
      })
    );
  }
  
  deleteConnection(id: number) {
    const connection = this.connections.find(c => c.id === id);
    if (!connection) return;
    
    // Check if built-in connection (you can add a builtin flag to your model)
    if ((connection as any).builtin) {
      this.toastService.showToast('Built-in connections cannot be deleted', 'info');
      return;
    }

    if (confirm(`Are you sure you want to delete connection "${connection.name}"?`)) {
      this.isLoading = true;
      this.subscriptions.add(
        this.dbService.deleteConnection(id).subscribe({
          next: (res: any) => {
            this.isLoading = false;
            if (res === false) {
              this.toastService.showToast('Unable to delete connection', 'error');
              return;
            }
            this.toastService.showToast('Connection removed', 'success');
            this.loadConnections(); // Reload the list
            this.cdr.detectChanges();
          },
          error: (error) => {
            this.isLoading = false;
            console.error('Error deleting connection:', error);
            this.toastService.showToast('Failed to delete connection', 'error');
            this.cdr.detectChanges();
          }
        })
      );
    }
  }
  
  setActiveConnection(connection: DatabaseConnection) {
    console.log('Setting active connection:', connection);
    this.dbService.setActiveConnection(connection);
    this.toastService.showToast(`Connected to ${connection.name}`, 'success');
    
    // Refresh table count for this connection
    this.refreshConnectionTables(connection.id);
    this.cdr.detectChanges();
  }
  
  browseConnection(connection: DatabaseConnection) {
    console.log('Browsing connection:', connection);
    this.dbService.setActiveConnection(connection);
    this.router.navigate(['/browse-data']);
    this.toastService.showToast(`Loading tables from ${connection.name}...`, 'info');
  }
  
  togglePassword() {
    this.showPassword = !this.showPassword;
  }
  
  resetForm() {
    this.newConnection = {
      name: '',
      type: 'PostgreSQL',
      server: '',
      port: '5432',
      database: '',
      username: '',
      password: '',
      status: 'Disconnected',
      tables: []
    };
    this.cdr.detectChanges();
  }
  
  refreshConnectionTables(id: number) {
    console.log('Refreshing tables for connection ID:', id);
    this.subscriptions.add(
      this.dbService.refreshConnectionTables(id).subscribe({
        next: (tables) => {
          console.log(`Refreshed ${tables.length} tables for connection ${id}:`, tables);
          this.toastService.showToast(`Found ${tables.length} tables`, 'success');
          
          // Update the connection in the local array
          const connIndex = this.connections.findIndex(c => c.id === id);
          if (connIndex !== -1) {
            this.connections[connIndex].tables = tables;
            this.connections = [...this.connections]; // Create new array to trigger change detection
            this.cdr.detectChanges();
          }
          
          // Reload connections to ensure data is fresh
          this.loadConnections();
        },
        error: (error) => {
          console.error('Error refreshing tables:', error);
          this.toastService.showToast('Failed to refresh tables', 'error');
        }
      })
    );
  }
  
 // Add these methods to your ConnectionsComponent class

getActiveConnectionsCount(): number {
  return this.connections.filter(c => c.status === 'Connected' ).length;
}

getStatusClass(status: string): string {
  if (!status) return '';
  const statusLower = String(status).toLowerCase();
  if (statusLower === 'connected') {
    return 'status-connected';
  }
  if (statusLower === 'connecting') {
    return 'status-connecting';
  }
  if (statusLower === 'error') {
    return 'status-error';
  }
  return 'status-disconnected';
}

removeToast(id: number) {
  this.toasts = this.toasts.filter(t => t.id !== id);
  this.cdr.detectChanges();
}

refreshAllConnections() {
  console.log('Refreshing all connections...');
  this.toastService.showToast('Refreshing all connections...', 'info');
  
  // Refresh each connection
  this.connections.forEach(conn => {
    this.refreshConnectionTables(conn.id);
  });
  
  // Also reload all connections
  this.loadConnections();
}
}