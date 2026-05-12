using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;  // Add this for ILogger
using MySql.Data.MySqlClient;
using Microsoft.Data.SqlClient;
using BIApp.Core.Interfaces;
using BIApp.Core.Models;
using BIApp.Infrastructure.Data;

namespace BIApp.Infrastructure.Services;

public class DbConnectionService : IDbConnectionService
{
    private readonly AppDbContext _context;
    private readonly ILogger<DbConnectionService> _logger;

    public DbConnectionService(AppDbContext context, ILogger<DbConnectionService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<DbConnectionConfig> CreateAsync(DbConnectionConfig config)
    {
        _context.DbConnections.Add(config);
        await _context.SaveChangesAsync();
        return config;
    }

    public async Task<IEnumerable<DbConnectionConfig>> GetAllAsync()
    {
        return await _context.DbConnections.ToListAsync();
    }

    public async Task<DbConnectionConfig> GetByIdAsync(int id)
    {
          var connection = await _context.DbConnections.FindAsync(id);
    return connection;
    }

    public async Task<bool> TestConnectionAsync(DbConnectionConfig config)
    {
        var provider = (config.Provider ?? "SqlServer").ToLowerInvariant();
        try
        {
            if (provider.Contains("mysql"))
            {
                var cs = $"Server={config.Server};Database={config.Database};Uid={config.Username};Pwd={config.Password};Connection Timeout=5;";
                using var connection = new MySqlConnection(cs);
                await connection.OpenAsync();
                _logger.LogInformation("Connection test successful for {Name}", config.Name);
                return true;
            }
            else
            {
                var cs = $"Server={config.Server};Database={config.Database};User Id={config.Username};Password={config.Password};Connection Timeout=5;TrustServerCertificate=True;";
                using var connection = new SqlConnection(cs);
                await connection.OpenAsync();
                return true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Connection test failed for {Name}", config.Name);
            return false;
        }
    }

    public async Task<bool> DeleteAsync(int id)
    {
        try
        {
            var entity = await _context.DbConnections.FindAsync(id);
            if (entity == null) return false;
            _context.DbConnections.Remove(entity);
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting connection {Id}", id);
            return false;
        }
    }

    // NEW METHOD: Get tables for a connection
    public async Task<string[]?> GetTablesForConnectionAsync(int connectionId)
    {
        try
        {
            var connection = await GetByIdAsync(connectionId);
            if (connection == null)
            {
                _logger.LogWarning("Connection with ID {ConnectionId} not found", connectionId);
                return null;
            }

            _logger.LogInformation("Fetching tables for connection: {Name} (Type: {Provider}, Server: {Server}, Database: {Database})", 
                connection.Name, connection.Provider, connection.Server, connection.Database);

            var provider = (connection.Provider ?? "SqlServer").ToLowerInvariant();
            var tables = new List<string>();

            if (provider.Contains("mysql"))
            {
                // MySQL connection
                var cs = $"Server={connection.Server};Database={connection.Database};Uid={connection.Username};Pwd={connection.Password};";
                using var conn = new MySqlConnection(cs);
                await conn.OpenAsync();
                
                // Query to get all tables in the database
                var query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @database AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
                using var cmd = new MySqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@database", connection.Database);
                
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    tables.Add(reader.GetString(0));
                }
            }
            else
            {
                // SQL Server connection
                var cs = $"Server={connection.Server};Database={connection.Database};User Id={connection.Username};Password={connection.Password};TrustServerCertificate=True;";
                using var conn = new SqlConnection(cs);
                await conn.OpenAsync();
                
                var query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
                using var cmd = new SqlCommand(query, conn);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    tables.Add(reader.GetString(0));
                }
            }

            _logger.LogInformation("Found {Count} tables for connection {Name}", tables.Count, connection.Name);
            
            if (tables.Count > 0)
            {
                _logger.LogInformation("Tables: {Tables}", string.Join(", ", tables));
            }

            return tables.ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tables for connection {ConnectionId}", connectionId);
            // Return empty array instead of null
            return Array.Empty<string>();
        }
    }

    // Optional: Update connection with tables
    public async Task<DbConnectionConfig?> UpdateConnectionWithTablesAsync(int connectionId)
    {
        var connection = await GetByIdAsync(connectionId);
        if (connection == null) return null;
        
        var tables = await GetTablesForConnectionAsync(connectionId);
        connection.Tables = tables;
        
        _context.DbConnections.Update(connection);
        await _context.SaveChangesAsync();
        
        return connection;
    }
}