using System;
using System.Collections.Generic;

namespace BIApp.Core.Models;

public class SavedQuestion
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Type { get; set; } // "visual" or "sql"
    public string Query { get; set; } = string.Empty;
    public string? TableName { get; set; }
    public string? GroupBy { get; set; }
    public string? Metric { get; set; }
    public string? MetricColumn { get; set; }
    public string? ChartType { get; set; }
    public string? FiltersJson { get; set; } // Store filters as JSON
    public string? SelectedColumnsJson { get; set; } // Store selected columns as JSON
    public DateTime CreatedAt { get; set; }
    public int? ConnectionId { get; set; }
    public string? ConnectionName { get; set; }
    
    public User User { get; set; } = null!;
}