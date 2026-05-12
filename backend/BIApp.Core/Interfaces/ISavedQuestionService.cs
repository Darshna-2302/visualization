// BIApp.Core/Interfaces/ISavedQuestionService.cs
using System.Collections.Generic;
using System.Threading.Tasks;
using BIApp.Core.DTOs;

namespace BIApp.Core.Interfaces;

public interface ISavedQuestionService
{
    Task<IEnumerable<SavedQuestionDto>> GetUserSavedQuestionsAsync(int userId);
    Task<SavedQuestionDto?> GetSavedQuestionByIdAsync(int id, int userId);
    Task<SavedQuestionDto> SaveQuestionAsync(int userId, CreateSavedQuestionDto dto);
    Task<bool> DeleteSavedQuestionAsync(int id, int userId);
    Task<bool> UpdateSavedQuestionAsync(int id, int userId, CreateSavedQuestionDto dto);
}