namespace BIApp.Core.Models;

public class DashboardWidget
{
    public int Id { get; set; }
    public int DashboardId { get; set; }
    public Dashboard Dashboard { get; set; } = null!;
    
    public int SavedQueryId { get; set; }
    public SavedQuery SavedQuery { get; set; } = null!;
    
    public string ChartType { get; set; } = "table"; // table, bar, line, pie
    
    // Grid layout properties
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
}
