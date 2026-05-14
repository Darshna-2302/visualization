using System.Collections.Generic;
using System.Threading.Tasks;
using BIApp.Core.Models;

namespace BIApp.Core.Interfaces;

public interface IQueryExecutionService
{
    Task<QueryResult> ExecuteQueryAsync(int connectionId, string query);
    Task<IEnumerable<string>> GetTablesAsync(int connectionId);
    Task<IEnumerable<string>> GetColumnsAsync(int connectionId, string tableName);
    bool IsSafeQuery(string query);
    Task<IEnumerable<object>> GetDistinctValuesAsync(int connectionId, string tableName, string columnName);
    Task<IEnumerable<Dictionary<string, object?>>> GetRowsByColumnValueAsync(int connectionId, string tableName, string columnName, object value);
    Task<IEnumerable<Dictionary<string, object?>>> GetSensorsByNodeAsync(int connectionId, string sensorJoinColumn, string nodeJoinColumn, object nodeValue);
}
