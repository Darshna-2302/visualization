using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using BIApp.Core.Interfaces;
using BIApp.Core.Models;
using BIApp.Core.DTOs;
using BIApp.Infrastructure.Data;

namespace BIApp.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthService(AppDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public async Task<AuthResponse?> AuthenticateAsync(string username, string password)
    {
        // Find user
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username == username);

        if (user == null)
            return null;

        // Verify password (you should use password hashing in production)
        var hashedInput = HashPassword(password);
        if (hashedInput != user.PasswordHash)
            return null;

        // Generate token
        var token = GenerateJwtToken(user);

        return new AuthResponse
        {
            Id = user.Id,
            Username = user.Username,
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddHours(8)
        };
    }

    public async Task<bool> RegisterAsync(string username, string password)
    {
        // Check if user already exists
        var existingUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Username == username);
        
        if (existingUser != null)
            return false; // User already exists

        // Create new user
        var user = new User
        {
            Username = username,
            PasswordHash = HashPassword(password), // Store SHA256 hash for now

        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        
        return true;
    }

    private string GenerateJwtToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            "this_is_a_very_secret_key_for_jwt_auth_must_be_long_enough"));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
        };

        var token = new JwtSecurityToken(
            issuer: null,
            audience: null,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string HashPassword(string password)
    {
        using var sha = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(password ?? string.Empty);
        var hash = sha.ComputeHash(bytes);
        var sb = new StringBuilder();
        foreach (var b in hash)
            sb.Append(b.ToString("x2"));
        return sb.ToString();
    }
}