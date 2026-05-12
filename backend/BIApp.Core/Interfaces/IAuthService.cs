using System.Threading.Tasks;
using BIApp.Core.DTOs;

namespace BIApp.Core.Interfaces;

public interface IAuthService
{
    Task<AuthResponse?> AuthenticateAsync(string username, string password);
    Task<bool> RegisterAsync(string username, string password);  // Changed to return bool and take two strings
}