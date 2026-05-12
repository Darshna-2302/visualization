import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-query-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatButtonModule, MatSelectModule, MatTableModule, 
    MatProgressSpinnerModule, MatButtonToggleModule, BaseChartDirective
  ],
  templateUrl: './query-editor.html',
  styleUrls: ['./query-editor.css']
})
export class QueryEditorComponent implements OnInit {
  connections: any[] = [];
  selectedConnectionId: number | null = null;
  query: string = 'SELECT TOP 10 * FROM YourTable';
  
  isLoading = false;
  error: string | null = null;
  
  queryData: any[] = [];
  columns: string[] = [];
  
  viewMode: 'table' | 'bar' | 'line' | 'pie' = 'table';
  
  // Chart configurations
  public chartType: ChartType = 'bar';
  public chartData: ChartConfiguration['data'] = {
    datasets: [],
    labels: []
  };
  public chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false
  };

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.apiService.getConnections().subscribe({
      next: (data) => this.connections = data,
      error: (err) => console.error(err)
    });
  }

  runQuery() {
    if (!this.selectedConnectionId || !this.query) return;

    this.isLoading = true;
    this.error = null;
    this.queryData = [];
    this.columns = [];

    this.apiService.runQuery(this.selectedConnectionId, this.query).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.queryData = data;
          this.columns = Object.keys(data[0]);
          this.updateChartData();
        } else {
          this.error = "Query executed successfully, but returned no data.";
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.error?.Error || err.error?.Details || "Failed to execute query.";
        this.isLoading = false;
      }
    });
  }

  updateChartData() {
    if (this.columns.length < 2) return; // Need at least 2 columns to plot something meaningful
    
    // Simple heuristic: use first column as labels, second column as data values
    const labelColumn = this.columns[0];
    let dataColumn = this.columns[1];
    
    // Try to find a numeric column for the data
    for (let col of this.columns) {
      if (typeof this.queryData[0][col] === 'number') {
        dataColumn = col;
        break;
      }
    }

    this.chartData = {
      labels: this.queryData.map(row => String(row[labelColumn])),
      datasets: [
        {
          data: this.queryData.map(row => Number(row[dataColumn])),
          label: dataColumn,
          backgroundColor: [
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)'
          ]
        }
      ]
    };
  }

  changeViewMode(mode: 'table' | 'bar' | 'line' | 'pie') {
    this.viewMode = mode;
    if (mode !== 'table') {
      this.chartType = mode;
      this.updateChartData();
    }
  }
}
