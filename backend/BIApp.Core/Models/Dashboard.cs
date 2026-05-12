using System.Collections.Generic;

namespace BIApp.Core.Models;

public class Dashboard
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<DashboardWidget> Widgets { get; set; } = new();
}
