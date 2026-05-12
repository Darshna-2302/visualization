using System.Threading.Tasks;
using BIApp.Core.DTOs;
using BIApp.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace BIApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var token = await _authService.AuthenticateAsync(request.Username, request.Password);
        
        if (token == null)
        {
            return Unauthorized(new { Message = "Invalid username or password" });
        }

        return Ok(token);
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { Message = "Username and password are required" });
        }

        var created = await _authService.RegisterAsync(request.Username, request.Password);
        if (!created)
        {
            return Conflict(new { Message = "Username already exists" });
        }

        return CreatedAtAction(nameof(Register), new { Username = request.Username }, new { Message = "User created" });
    }
}
