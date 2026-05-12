import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <div class="page-header">
        <h1 class="page-title">Executive Overview</h1>
        <p class="page-description">Key metrics and performance indicators</p>
      </div>
      
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header">
            <h3>Total Revenue</h3>
            <span class="kpi-icon">💰</span>
          </div>
          <div class="kpi-value">$338,600</div>
          <div class="kpi-trend positive">▲ +12% this month</div>
        </div>
        
        <div class="kpi-card">
          <div class="kpi-header">
            <h3>Total Orders</h3>
            <span class="kpi-icon">📦</span>
          </div>
          <div class="kpi-value">20</div>
          <div class="kpi-trend positive">▲ +5% vs last month</div>
        </div>
        
        <div class="kpi-card">
          <div class="kpi-header">
            <h3>Total Customers</h3>
            <span class="kpi-icon">👥</span>
          </div>
          <div class="kpi-value">15</div>
          <div class="kpi-trend positive">▲ +8% vs last month</div>
        </div>
      </div>
      
      <div class="charts-grid">
        <div class="chart-card">
          <h3>Revenue vs Expenses</h3>
          <div class="chart-placeholder">
            <div class="bar-chart">
              <div *ngFor="let item of revenueData" class="bar-item">
                <div class="bar-label">{{item.month}}</div>
                <div class="bar-revenue" [style.width.%]="item.revenuePercent"></div>
                <div class="bar-expenses" [style.width.%]="item.expensesPercent"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="chart-card">
          <h3>Orders by Status</h3>
          <div class="pie-chart-placeholder">
            <div class="pie-segments">
              <div class="pie-segment paid">Paid (60%)</div>
              <div class="pie-segment pending">Pending (25%)</div>
              <div class="pie-segment cancelled">Cancelled (15%)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      width: 100%;
    }
    .page-header {
      margin-bottom: 32px;
    }
    .page-title {
      font-size: 32px;
      font-weight: 700;
      color: #0b1c30;
      margin: 0 0 8px;
    }
    .page-description {
      font-size: 14px;
      color: #404750;
      margin: 0;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }
    .kpi-card {
      background: white;
      padding: 24px;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.04);
    }
    .kpi-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .kpi-header h3 {
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
      margin: 0;
    }
    .kpi-icon {
      font-size: 24px;
    }
    .kpi-value {
      font-size: 32px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .kpi-trend {
      font-size: 12px;
    }
    .kpi-trend.positive {
      color: #22c55e;
    }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
    }
    .chart-card {
      background: white;
      padding: 24px;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
    }
    .chart-card h3 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 16px;
    }
    .chart-placeholder {
      min-height: 200px;
    }
    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bar-item {
      position: relative;
    }
    .bar-label {
      font-size: 12px;
      margin-bottom: 4px;
    }
    .bar-revenue {
      height: 20px;
      background: #3b82f6;
      border-radius: 4px;
      margin-bottom: 2px;
    }
    .bar-expenses {
      height: 20px;
      background: #f97316;
      border-radius: 4px;
    }
    .pie-chart-placeholder {
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pie-segments {
      width: 200px;
    }
    .pie-segment {
      padding: 8px;
      margin: 4px 0;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
    }
    .pie-segment.paid {
      background: #22c55e20;
      color: #22c55e;
    }
    .pie-segment.pending {
      background: #eab30820;
      color: #eab308;
    }
    .pie-segment.cancelled {
      background: #ef444420;
      color: #ef4444;
    }
  `]
})
export class DashboardComponent {
  revenueData = [
    { month: 'Jan', revenue: 100, expenses: 60, revenuePercent: 100, expensesPercent: 60 },
    { month: 'Feb', revenue: 120, expenses: 70, revenuePercent: 120, expensesPercent: 70 },
    { month: 'Mar', revenue: 140, expenses: 80, revenuePercent: 140, expensesPercent: 80 }
  ];
}