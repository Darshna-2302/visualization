using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using BIApp.Core.Interfaces;
using BIApp.Core.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace BIApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Microsoft.AspNetCore.Authorization.Authorize]
public class DbConnectionController : ControllerBase
{
    private readonly IDbConnectionService _connectionService;
    private readonly ILogger<DbConnectionController> _logger;

    public DbConnectionController(IDbConnectionService connectionService, ILogger<DbConnectionController> logger)
    {
        _connectionService = connectionService;
        _logger = logger;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim))
            throw new UnauthorizedAccessException("User ID not found in token");
        return int.Parse(userIdClaim);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var persisted = (await _connectionService.GetAllAsync())?.ToList() ?? new List<DbConnectionConfig>();
            // filter persisted connections: include global (UserId == null) and those owned by current user
            var userId = GetUserId();
            persisted = persisted.Where(c => c.UserId == null || c.UserId == userId).ToList();
            var result = new List<object>();

            // Built-in demo connection
            var builtin = new
            {
                id = 1,
                name = "Local Demo DB",
                type = "Builtin",
                server = "localhost",
                database = "demo",
                username = string.Empty,
                password = string.Empty,
                provider = "Builtin",
                tables = new[] { "orders", "customers", "products", "revenue", "inventory", "shipments", "returns" },
                builtin = true
            };

            // If no persisted connection uses id 1, include builtin
            if (!persisted.Any(p => p.Id == 1)) 
                result.Add(builtin);

            // Map persisted connections and fetch their tables
            foreach (var c in persisted)
            {
                // Fetch actual tables from the database
                string[]? tables = null;
                try
                {
                    tables = await _connectionService.GetTablesForConnectionAsync(c.Id);
                    _logger.LogInformation("Loaded connection: {Name} - Found {TableCount} tables", c.Name, tables?.Length ?? 0);
                    
                    if (tables != null && tables.Length > 0)
                    {
                        _logger.LogInformation("Tables for {Name}: {Tables}", c.Name, string.Join(", ", tables));
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error fetching tables for connection {Name}", c.Name);
                    tables = Array.Empty<string>();
                }

                result.Add(new
                {
                    id = c.Id,
                    name = c.Name,
                    type = string.IsNullOrWhiteSpace(c.Type) ? c.Provider : c.Type,
                    server = c.Server,
                    database = c.Database,
                    username = string.Empty,
                    password = string.Empty,
                    provider = c.Provider,
                    tables = tables ?? Array.Empty<string>(),
                    builtin = false
                });
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all connections");
            return StatusCode(500, new { error = "Failed to retrieve connections", message = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            if (id == 1)
            {
                return Ok(new
                {
                    id = 1,
                    name = "Local Demo DB",
                    type = "Builtin",
                    server = "localhost",
                    database = "demo",
                    username = string.Empty,
                    provider = "Builtin",
                    status = "Connected",
                    builtin = true,
                    tables = new[] { "orders", "customers", "products", "revenue", "inventory" }
                });
            }

            var connection = await _connectionService.GetByIdAsync(id);
            if (connection == null)
                return NotFound(new { error = $"Connection with ID {id} not found" });

            // Ensure user can access this connection
            var userId = GetUserId();
            if (connection.UserId != null && connection.UserId != userId)
            {
                return Forbid();
            }

            // Fetch tables for this connection
            var tables = await _connectionService.GetTablesForConnectionAsync(id);

            return Ok(new
            {
                id = connection.Id,
                name = connection.Name,
                type = string.IsNullOrWhiteSpace(connection.Type) ? connection.Provider : connection.Type,
                server = connection.Server,
                database = connection.Database,
                username = connection.Username,
                provider = connection.Provider,
                status = connection.Status,
                builtin = false,
                tables = tables ?? Array.Empty<string>(),
                createdAt = connection.CreatedAt,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting connection {Id}", id);
            return StatusCode(500, new { error = "Failed to retrieve connection", message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DbConnectionConfig config)
    {
        try
        {
            // Validate required fields
            if (string.IsNullOrWhiteSpace(config.Name))
                return BadRequest(new { error = "Connection name is required" });
            
            if (string.IsNullOrWhiteSpace(config.Server))
                return BadRequest(new { error = "Server/Host is required" });
            
            if (string.IsNullOrWhiteSpace(config.Database))
                return BadRequest(new { error = "Database name is required" });
            
            // Set default provider if not specified
            if (string.IsNullOrWhiteSpace(config.Provider))
                config.Provider = config.Type ?? "MySQL";
            
            if (string.IsNullOrWhiteSpace(config.Type))
                config.Type = config.Provider;
            
            // Set default port based on provider
            if (config.Port == 0)
            {
                config.Port = config.Provider?.ToLower() == "mysql" ? 3306 : 5432;
            }
            
            // Test connection first
            var testSuccess = await _connectionService.TestConnectionAsync(config);
            if (!testSuccess)
            {
                return BadRequest(new { error = "Cannot save connection. Connection test failed. Please check your credentials." });
            }
            
            config.Status = "connected";
            config.CreatedAt = DateTime.UtcNow;
            // assign owner
            try { config.UserId = GetUserId(); } catch { /* ignore if no token */ }
            var result = await _connectionService.CreateAsync(config);
            
            // Fetch tables for the new connection
            var tables = await _connectionService.GetTablesForConnectionAsync(result.Id);
            
            _logger.LogInformation("Created new connection: {Name} with {TableCount} tables", result.Name, tables?.Length ?? 0);
            
            return Ok(new
            {
                id = result.Id,
                name = result.Name,
                type = result.Type,
                server = result.Server,
                database = result.Database,
                username = result.Username,
                provider = result.Provider,
                status = result.Status,
                tables = tables ?? Array.Empty<string>(),
                builtin = false,
                createdAt = result.CreatedAt,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating connection: {Name}", config.Name);
            return StatusCode(500, new { error = "Failed to create connection", message = ex.Message });
        }
    }

    [HttpPost("test")]
    public async Task<IActionResult> TestConnection([FromBody] DbConnectionConfig config)
    {
        try
        {
            var success = await _connectionService.TestConnectionAsync(config);
            if (success)
            {
                return Ok(new { 
                    success = true, 
                    message = $"Connection successful! Connected to database '{config.Database}'." 
                });
            }
            
            return Ok(new { success = false, message = "Connection failed. Please check your credentials." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error testing connection");
            return Ok(new { success = false, message = $"Connection failed: {ex.Message}" });
        }
    }

    [HttpGet("{id}/tables")]
    public async Task<IActionResult> GetTables(int id)
    {
        try
        {
            var tables = await _connectionService.GetTablesForConnectionAsync(id);
            return Ok(new { tables = tables ?? Array.Empty<string>() });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tables for connection {Id}", id);
            return StatusCode(500, new { error = "Failed to get tables", message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            if (id == 1)
                return BadRequest(new { error = "Cannot delete the built-in demo connection" });
            var connection = await _connectionService.GetByIdAsync(id);
            if (connection == null) return NotFound(new { error = $"Connection with ID {id} not found" });

            // only owner can delete
            var userId = GetUserId();
            if (connection.UserId != null && connection.UserId != userId)
                return Forbid();

            var success = await _connectionService.DeleteAsync(id);
            if (success) 
                return Ok(new { success = true, message = "Connection deleted successfully" });
            
            return NotFound(new { error = $"Connection with ID {id} not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting connection {Id}", id);
            return StatusCode(500, new { error = "Failed to delete connection", message = ex.Message });
        }
    }
}