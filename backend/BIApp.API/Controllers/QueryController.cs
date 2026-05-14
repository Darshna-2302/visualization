using System;
using System.Threading.Tasks;
using BIApp.Core.Interfaces;
using BIApp.Core.Models;
using Microsoft.AspNetCore.Mvc;

namespace BIApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class QueryController : ControllerBase
{
    private readonly IQueryExecutionService _queryService;
    private readonly IDbConnectionService _connService;

    public QueryController(IQueryExecutionService queryService, IDbConnectionService connService)
    {
        _queryService = queryService;
        _connService = connService;
    }

    public class QueryRequest
    {
        public int ConnectionId { get; set; }
        public string Query { get; set; } = string.Empty;
    }

    [HttpPost("run")]
    public async Task<IActionResult> RunQuery(QueryRequest request)
    {
        try
        {
                // If the connection is the built-in demo connection (not persisted), serve mock data
                var conn = _connService != null ? await _connService.GetByIdAsync(request.ConnectionId) : null;
                if (conn == null && request.ConnectionId == 1)
                {
                    // very small in-memory mock: support "SELECT * FROM <table>" only
                    var m = System.Text.RegularExpressions.Regex.Match(request.Query ?? string.Empty, "FROM\\s+([a-zA-Z0-9_]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (m.Success)
                    {
                        var table = m.Groups[1].Value;
                        var mock = BuiltinSchema();
                        if (mock.ContainsKey(table))
                        {
                            var rows = mock[table];
                            var cols = rows.Count > 0 ? new List<string>(rows[0].Keys) : new List<string>();
                            return Ok(new { columns = cols, rows = rows, executionTime = 5, rowCount = rows.Count });
                        }
                    }
                    return BadRequest(new { Error = "Unsupported demo query" });
                }

                var result = await _queryService.ExecuteQueryAsync(request.ConnectionId, request.Query);
                return Ok(new {
                    columns = result.Columns,
                    rows = result.Rows,
                    executionTime = result.ExecutionTimeMs,
                    rowCount = result.RowCount
                });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = "An error occurred while executing the query.", Details = ex.Message });
        }
    }

    [HttpGet("tables/{connectionId}")]
    public async Task<IActionResult> GetTables(int connectionId)
    {
        try
        {
            var conn = await _connService.GetByIdAsync(connectionId);
            if (conn == null && connectionId == 1)
            {
                var mock = BuiltinSchema();
                return Ok(mock.Keys);
            }
            var tables = await _queryService.GetTablesAsync(connectionId);
            return Ok(tables);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = "Failed to load tables.", Details = ex.Message });
        }
    }

    [HttpGet("columns/{connectionId}/{tableName}")]
    public async Task<IActionResult> GetColumns(int connectionId, string tableName)
    {
        try
        {
            var conn = await _connService.GetByIdAsync(connectionId);
            if (conn == null && connectionId == 1)
            {
                var mock = BuiltinSchema();
                if (mock.ContainsKey(tableName))
                {
                    var rows = mock[tableName];
                    var cols = rows.Count > 0 ? new List<string>(rows[0].Keys) : new List<string>();
                    return Ok(cols);
                }
                return NotFound();
            }
            var colsResult = await _queryService.GetColumnsAsync(connectionId, tableName);
            return Ok(colsResult);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = "Failed to load columns.", Details = ex.Message });
        }
    }

    [HttpGet("distinct/{connectionId}/{tableName}/{columnName}")]
    public async Task<IActionResult> GetDistinctValues(int connectionId, string tableName, string columnName)
    {
        try
        {
            var conn = await _connService.GetByIdAsync(connectionId);
            if (conn == null && connectionId == 1)
            {
                var mock = BuiltinSchema();
                if (mock.ContainsKey(tableName))
                {
                    var vals = mock[tableName].Where(r => r.ContainsKey(columnName)).Select(r => r[columnName]).Where(v => v != null).Distinct().ToList();
                    return Ok(vals);
                }
                return NotFound();
            }

            var valsResult = await _queryService.GetDistinctValuesAsync(connectionId, tableName, columnName);
            return Ok(valsResult);
        }
        catch (KeyNotFoundException knf)
        {
            return NotFound(new { Error = knf.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = "Failed to load distinct values.", Details = ex.Message });
        }
    }

    [HttpGet("filter/{connectionId}/{tableName}/{columnName}")]
    public async Task<IActionResult> GetRowsByColumnValue(int connectionId, string tableName, string columnName, [FromQuery] string value)
    {
        try
        {
            var conn = await _connService.GetByIdAsync(connectionId);
            if (conn == null && connectionId == 1)
            {
                var mock = BuiltinSchema();
                if (mock.ContainsKey(tableName))
                {
                    var rows = mock[tableName].Where(r => r.ContainsKey(columnName) && String.Equals(Convert.ToString(r[columnName]), value, StringComparison.Ordinal)).ToList();
                    return Ok(rows);
                }
                return NotFound();
            }

            var rowsResult = await _queryService.GetRowsByColumnValueAsync(connectionId, tableName, columnName, value);
            return Ok(rowsResult);
        }
        catch (KeyNotFoundException knf)
        {
            return NotFound(new { Error = knf.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = "Failed to load filtered rows.", Details = ex.Message });
        }
    }

    [HttpGet("sensors-by-node/{connectionId}/{sensorJoinColumn}/{nodeJoinColumn}")]
    public async Task<IActionResult> GetSensorsByNode(int connectionId, string sensorJoinColumn, string nodeJoinColumn, [FromQuery] string value)
    {
        try
        {
            var conn = await _connService.GetByIdAsync(connectionId);
            if (conn == null && connectionId == 1)
            {
                var mock = BuiltinSchema();
                if (mock.ContainsKey("sensor") && mock.ContainsKey("node"))
                {
                    var sensors = mock["sensor"];
                    var nodes = mock["node"];
                    var matched = sensors.Where(s => nodes.Any(n => n.ContainsKey(nodeJoinColumn) && s.ContainsKey(sensorJoinColumn) && String.Equals(Convert.ToString(n[nodeJoinColumn]), value, StringComparison.Ordinal) && String.Equals(Convert.ToString(s[sensorJoinColumn]), Convert.ToString(n[nodeJoinColumn]), StringComparison.Ordinal))).ToList();
                    return Ok(matched);
                }
                return NotFound();
            }

            var rows = await _queryService.GetSensorsByNodeAsync(connectionId, sensorJoinColumn, nodeJoinColumn, value);
            return Ok(rows);
        }
        catch (KeyNotFoundException knf)
        {
            return NotFound(new { Error = knf.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = "Failed to load sensors by node.", Details = ex.Message });
        }
    }

    private static Dictionary<string, List<Dictionary<string, object?>>> BuiltinSchema()
    {
        return new Dictionary<string, List<Dictionary<string, object?>>> {
            ["orders"] = new List<Dictionary<string, object?>> {
                new Dictionary<string, object?> { ["id"] = 1, ["customer_name"] = "Alice Johnson", ["product"] = "Pro Plan", ["amount"] = 299, ["status"] = "paid", ["created_at"] = "2024-01-05" },
                new Dictionary<string, object?> { ["id"] = 2, ["customer_name"] = "Bob Smith", ["product"] = "Basic Plan", ["amount"] = 99, ["status"] = "paid", ["created_at"] = "2024-01-08" }
            },
            ["customers"] = new List<Dictionary<string, object?>> {
                new Dictionary<string, object?> { ["id"] = 1, ["name"] = "Alice Johnson", ["email"] = "alice@example.com", ["country"] = "USA" },
                new Dictionary<string, object?> { ["id"] = 2, ["name"] = "Bob Smith", ["email"] = "bob@example.com", ["country"] = "UK" }
            },
            ["products"] = new List<Dictionary<string, object?>> {
                new Dictionary<string, object?> { ["id"] = 1, ["name"] = "Basic Plan", ["category"] = "Subscription", ["price"] = 99 },
                new Dictionary<string, object?> { ["id"] = 2, ["name"] = "Pro Plan", ["category"] = "Subscription", ["price"] = 299 }
            },
            ["revenue"] = new List<Dictionary<string, object?>> {
                new Dictionary<string, object?> { ["month"] = "Jan", ["revenue"] = 18200, ["expenses"] = 11000, ["profit"] = 7200 }
            },
            ["inventory"] = new List<Dictionary<string, object?>> {
                new Dictionary<string, object?> { ["sku"] = "A100", ["name"] = "Pro Plan", ["stock"] = 500 }
            },
            ["shipments"] = new List<Dictionary<string, object?>> {
                new Dictionary<string, object?> { ["id"] = 1, ["order_id"] = 1, ["carrier"] = "UPS", ["status"] = "delivered" }
            },
            ["returns"] = new List<Dictionary<string, object?>> {
                new Dictionary<string, object?> { ["id"] = 1, ["order_id"] = 2, ["reason"] = "damaged", ["refunded"] = 99 }
            }
        };
    }
}
