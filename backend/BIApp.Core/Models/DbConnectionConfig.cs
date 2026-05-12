using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace BIApp.Core.Models;

public class DbConnectionConfig
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Server { get; set; } = string.Empty;
    public string Database { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty; // In a real app, encrypt this!
    public string Type { get; set; } = string.Empty;
    // Provider indicates which database provider this connection uses, e.g. "SqlServer", "MySql"
    public string Provider { get; set; } = "SqlServer";
    public int Port { get; set; }
    public string Status { get; set; } = "disconnected";
    // Optional owner user id. Null => built-in / global connection
    public int? UserId { get; set; }
    [NotMapped]
    public string[]? Tables { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
