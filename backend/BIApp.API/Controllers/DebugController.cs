using Microsoft.AspNetCore.Mvc;
using BIApp.Infrastructure.Data;

namespace BIApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DebugController : ControllerBase
{
    private readonly AppDbContext _context;
    public DebugController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("users")]
    public IActionResult GetUsers()
    {
        var users = _context.Users.Select(u => new { u.Id, u.Username, u.PasswordHash, u.Role }).ToList();
        return Ok(users);
    }
}
