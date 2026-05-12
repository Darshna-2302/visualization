using System.Collections.Generic;
using System.Threading.Tasks;
using BIApp.Core.Models;

namespace BIApp.Core.Interfaces;

public interface IDbConnectionService
{
    Task<DbConnectionConfig> CreateAsync(DbConnectionConfig config);
    Task<DbConnectionConfig> GetByIdAsync(int id);
    Task<IEnumerable<DbConnectionConfig>> GetAllAsync();
    Task<bool> TestConnectionAsync(DbConnectionConfig config);
    Task<bool> DeleteAsync(int id);
    
    // Add these new methods
    Task<string[]?> GetTablesForConnectionAsync(int connectionId);
    Task<DbConnectionConfig?> UpdateConnectionWithTablesAsync(int connectionId);
}