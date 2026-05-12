using System;

namespace BIApp.Core.Models;

public class SavedQuery
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string QueryText { get; set; } = string.Empty;
    public int DbConnectionId { get; set; }
    public DbConnectionConfig DbConnection { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
