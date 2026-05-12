using System;
using System.Collections.Generic;

namespace BIApp.Core.DTOs;

public class SavedQuestionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Type { get; set; }
    public string Query { get; set; } = string.Empty;
    public string? TableName { get; set; }
    public string? GroupBy { get; set; }
    public string? Metric { get; set; }
    public string? MetricColumn { get; set; }
    public string? ChartType { get; set; }
    public List<FilterDto>? Filters { get; set; }
    public List<string>? SelectedColumns { get; set; }
    public int? ConnectionId { get; set; }
    public string? ConnectionName { get; set; }
    public DateTime CreatedAt { get; set; }
    public int UserId { get; set; }
}

public class CreateSavedQuestionDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Query { get; set; } = string.Empty;
    public string TableName { get; set; } = string.Empty;
    public string? GroupBy { get; set; }
    public string? Metric { get; set; }
    public string? MetricColumn { get; set; }
    public string? ChartType { get; set; }
    public List<FilterDto>? Filters { get; set; }
    public List<string>? SelectedColumns { get; set; }
    public int? ConnectionId { get; set; }
    public string? ConnectionName { get; set; }
}

public class FilterDto
{
    public string Column { get; set; } = string.Empty;
    public string Operator { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}