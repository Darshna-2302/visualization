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
}
