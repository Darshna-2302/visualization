using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BIApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BIApp.API.Controllers;

[ApiController]
[Route("api/debug/schema")]
public class DebugSchemaController : ControllerBase
{
    private readonly AppDbContext _db;
    public DebugSchemaController(AppDbContext db) { _db = db; }

    [HttpGet("savedquestions")]
    public IActionResult GetSavedQuestionsSchema()
    {
        try
        {
            var conn = _db.Database.GetDbConnection();
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "PRAGMA table_info('SavedQuestions');";
            using var reader = cmd.ExecuteReader();
            var cols = new System.Collections.Generic.List<object>();
            while (reader.Read())
            {
                cols.Add(new {
                    cid = reader.GetInt32(reader.GetOrdinal("cid")),
                    name = reader.GetString(reader.GetOrdinal("name")),
                    type = reader.GetString(reader.GetOrdinal("type")),
                    notnull = reader.GetInt32(reader.GetOrdinal("notnull")),
                    dflt_value = reader.IsDBNull(reader.GetOrdinal("dflt_value")) ? null : reader.GetString(reader.GetOrdinal("dflt_value")),
                    pk = reader.GetInt32(reader.GetOrdinal("pk"))
                });
            }
            return Ok(cols);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
