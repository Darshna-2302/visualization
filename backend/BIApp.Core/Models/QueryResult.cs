using System.Collections.Generic;

namespace BIApp.Core.Models;

public class QueryResult
{
    public List<string> Columns { get; set; } = new List<string>();
    public List<Dictionary<string, object?>> Rows { get; set; } = new List<Dictionary<string, object?>>();
    public double ExecutionTimeMs { get; set; }
    public int RowCount => Rows?.Count ?? 0;
}
