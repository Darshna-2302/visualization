
using System;
using System.Collections.Generic;
using System.Data;
using System.Diagnostics;  // Add this for Stopwatch
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dapper;
using Microsoft.EntityFrameworkCore;
using MySql.Data.MySqlClient;
using Microsoft.Data.SqlClient;
using BIApp.Core.Interfaces;
using BIApp.Core.Models;
using BIApp.Core.DTOs;
using BIApp.Infrastructure.Data;

namespace BIApp.Infrastructure.Services;

public class QueryExecutionService : IQueryExecutionService
{
    private readonly AppDbContext _context;

    public QueryExecutionService(AppDbContext context)
    {
        _context = context;
    }
    public async Task<QueryResult> ExecuteQueryAsync(int connectionId, string query)
    {
        if (!IsSafeQuery(query))
        {
            throw new InvalidOperationException("Only SELECT queries are allowed for security reasons.");
        }

        var connectionConfig = await _context.DbConnections.FindAsync(connectionId);
        if (connectionConfig == null)
        {
            throw new KeyNotFoundException("Database connection not found.");
        }

        var provider = (connectionConfig.Provider ?? "SqlServer").ToLowerInvariant();

        // Build connection and execute
        IEnumerable<dynamic> rows;
        var sw = Stopwatch.StartNew();

        if (provider.Contains("mysql"))
        {
            var cs = $"Server={connectionConfig.Server};Database={connectionConfig.Database};Uid={connectionConfig.Username};Pwd={connectionConfig.Password};SslMode=Preferred;";
            using var connection = new MySqlConnection(cs);
            await connection.OpenAsync();
            rows = await connection.QueryAsync(query);
        }
        else // default to SQL Server
        {
            var cs = $"Server={connectionConfig.Server};Database={connectionConfig.Database};User Id={connectionConfig.Username};Password={connectionConfig.Password};TrustServerCertificate=True;";
            using var connection = new SqlConnection(cs);
            await ((SqlConnection)connection).OpenAsync();
            rows = await connection.QueryAsync(query);
        }

        sw.Stop();

        // Normalize dynamic results into QueryResult
        var result = new QueryResult();
        var listRows = new List<Dictionary<string, object?>>();

        foreach (var r in rows)
        {
            if (r is IDictionary<string, object> dict)
            {
                var rowDict = dict.ToDictionary(kv => kv.Key, kv => (object?)kv.Value);
                listRows.Add(rowDict);
            }
            else
            {
                // Fallback: use reflection to read properties
                var rowDict = new Dictionary<string, object?>();
                foreach (var prop in r.GetType().GetProperties())
                {
                    rowDict[prop.Name] = prop.GetValue(r);
                }
                listRows.Add(rowDict);
            }
        }

        if (listRows.Count > 0)
        {
            result.Columns = listRows[0].Keys.ToList();
            result.Rows = listRows;
        }
        result.ExecutionTimeMs = sw.Elapsed.TotalMilliseconds;
        return result;
    }

    public bool IsSafeQuery(string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return false;

        // Simple validation: must start with SELECT, and not contain dangerous keywords
        var upperQuery = query.Trim().ToUpper();
        
        if (!upperQuery.StartsWith("SELECT"))
        {
            return false;
        }

        // Check for disallowed commands
        string[] disallowedKeywords = { "INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", "CREATE", "EXEC", "EXECUTE", "GRANT", "REVOKE" };

        // Use regex to match whole words only to avoid false positives (e.g., "SELECTION")
        foreach (var keyword in disallowedKeywords)
        {
            if (Regex.IsMatch(upperQuery, $@"\b{keyword}\b"))
            {
                return false;
            }
        }

        return true;
    }

    public async Task<IEnumerable<string>> GetTablesAsync(int connectionId)
    {
        var connectionConfig = await _context.DbConnections.FindAsync(connectionId);
        if (connectionConfig == null) throw new KeyNotFoundException("Database connection not found.");
        var provider = (connectionConfig.Provider ?? "SqlServer").ToLowerInvariant();

        if (provider.Contains("mysql"))
        {
            var cs = $"Server={connectionConfig.Server};Database={connectionConfig.Database};Uid={connectionConfig.Username};Pwd={connectionConfig.Password};SslMode=Preferred;";
            using var connection = new MySqlConnection(cs);
            await connection.OpenAsync();
            var q = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @db AND TABLE_TYPE = 'BASE TABLE'";
            var tables = await connection.QueryAsync<string>(q, new { db = connectionConfig.Database });
            return tables;
        }
        else
        {
            var cs = $"Server={connectionConfig.Server};Database={connectionConfig.Database};User Id={connectionConfig.Username};Password={connectionConfig.Password};TrustServerCertificate=True;";
            using var connection = new SqlConnection(cs);
            await connection.OpenAsync();
            var q = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_CATALOG = @db AND TABLE_TYPE = 'BASE TABLE'";
            var tables = await connection.QueryAsync<string>(q, new { db = connectionConfig.Database });
            return tables;
        }
    }

    public async Task<IEnumerable<string>> GetColumnsAsync(int connectionId, string tableName)
    {
        var connectionConfig = await _context.DbConnections.FindAsync(connectionId);
        if (connectionConfig == null) throw new KeyNotFoundException("Database connection not found.");
        var provider = (connectionConfig.Provider ?? "SqlServer").ToLowerInvariant();

        if (provider.Contains("mysql"))
        {
            var cs = $"Server={connectionConfig.Server};Database={connectionConfig.Database};Uid={connectionConfig.Username};Pwd={connectionConfig.Password};SslMode=Preferred;";
            using var connection = new MySqlConnection(cs);
            await connection.OpenAsync();
            var q = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = @table ORDER BY ORDINAL_POSITION";
            var cols = await connection.QueryAsync<string>(q, new { db = connectionConfig.Database, table = tableName });
            return cols;
        }
        else
        {
            var cs = $"Server={connectionConfig.Server};Database={connectionConfig.Database};User Id={connectionConfig.Username};Password={connectionConfig.Password};TrustServerCertificate=True;";
            using var connection = new SqlConnection(cs);
            await connection.OpenAsync();
            var q = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_CATALOG = @db AND TABLE_NAME = @table ORDER BY ORDINAL_POSITION";
            var cols = await connection.QueryAsync<string>(q, new { db = connectionConfig.Database, table = tableName });
            return cols;
        }
    }
}
