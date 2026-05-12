using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using BIApp.Core.Interfaces;
using BIApp.Core.Models;
using BIApp.Core.DTOs;
using BIApp.Infrastructure.Data;

namespace BIApp.Infrastructure.Services;

public class SavedQuestionService : ISavedQuestionService
{
    private readonly AppDbContext _context;

    public SavedQuestionService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<SavedQuestionDto>> GetUserSavedQuestionsAsync(int userId)
    {
        try
        {
            var questions = await _context.SavedQuestions
                .Where(q => q.UserId == userId)
                .OrderByDescending(q => q.CreatedAt)
                .ToListAsync();

            return questions.Select(q => new SavedQuestionDto
            {
                Id = q.Id,
                Name = q.Name,
                Type = q.Type,
                Query = q.Query,
                TableName = q.TableName,
                GroupBy = q.GroupBy,
                Metric = q.Metric,
                MetricColumn = q.MetricColumn,
                ChartType = q.ChartType,
                Filters = string.IsNullOrEmpty(q.FiltersJson) ? null : JsonSerializer.Deserialize<List<FilterDto>>(q.FiltersJson),
                SelectedColumns = string.IsNullOrEmpty(q.SelectedColumnsJson) ? null : JsonSerializer.Deserialize<List<string>>(q.SelectedColumnsJson),
                ConnectionId = q.ConnectionId,
                ConnectionName = q.ConnectionName,
                CreatedAt = q.CreatedAt,
                UserId = q.UserId
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting saved questions: {ex.Message}");
            return new List<SavedQuestionDto>();
        }
    }

    public async Task<SavedQuestionDto?> GetSavedQuestionByIdAsync(int id, int userId)
    {
        try
        {
            var question = await _context.SavedQuestions
                .FirstOrDefaultAsync(q => q.Id == id && q.UserId == userId);

            if (question == null) return null;

            return new SavedQuestionDto
            {
                Id = question.Id,
                Name = question.Name,
                Type = question.Type,
                Query = question.Query,
                TableName = question.TableName,
                GroupBy = question.GroupBy,
                Metric = question.Metric,
                MetricColumn = question.MetricColumn,
                ChartType = question.ChartType,
                Filters = string.IsNullOrEmpty(question.FiltersJson) ? null : JsonSerializer.Deserialize<List<FilterDto>>(question.FiltersJson),
                SelectedColumns = string.IsNullOrEmpty(question.SelectedColumnsJson) ? null : JsonSerializer.Deserialize<List<string>>(question.SelectedColumnsJson),
                ConnectionId = question.ConnectionId,
                ConnectionName = question.ConnectionName,
                CreatedAt = question.CreatedAt,
                UserId = question.UserId
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting saved question by id: {ex.Message}");
            return null;
        }
    }

    public async Task<SavedQuestionDto> SaveQuestionAsync(int userId, CreateSavedQuestionDto dto)
    {
        try
        {
            var savedQuestion = new SavedQuestion
            {
                UserId = userId,
                Name = dto.Name,
                Type = dto.Type,
                Query = dto.Query,
                TableName = dto.TableName,
                GroupBy = dto.GroupBy,
                Metric = dto.Metric,
                MetricColumn = dto.MetricColumn,
                ChartType = dto.ChartType,
                ConnectionId = dto.ConnectionId,
                ConnectionName = dto.ConnectionName,
                FiltersJson = dto.Filters != null ? JsonSerializer.Serialize(dto.Filters) : null,
                SelectedColumnsJson = dto.SelectedColumns != null ? JsonSerializer.Serialize(dto.SelectedColumns) : null,
                CreatedAt = DateTime.UtcNow
            };

            _context.SavedQuestions.Add(savedQuestion);
            await _context.SaveChangesAsync();

            return new SavedQuestionDto
            {
                Id = savedQuestion.Id,
                Name = savedQuestion.Name,
                Type = savedQuestion.Type,
                Query = savedQuestion.Query,
                TableName = savedQuestion.TableName,
                GroupBy = savedQuestion.GroupBy,
                Metric = savedQuestion.Metric,
                MetricColumn = savedQuestion.MetricColumn,
                ChartType = savedQuestion.ChartType,
                Filters = dto.Filters,
                SelectedColumns = dto.SelectedColumns,
                ConnectionId = savedQuestion.ConnectionId,
                ConnectionName = savedQuestion.ConnectionName,
                CreatedAt = savedQuestion.CreatedAt,
                UserId = savedQuestion.UserId
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error saving question: {ex.Message}");
            throw;
        }
    }

    public async Task<bool> DeleteSavedQuestionAsync(int id, int userId)
    {
        try
        {
            var question = await _context.SavedQuestions
                .FirstOrDefaultAsync(q => q.Id == id && q.UserId == userId);

            if (question == null) return false;

            _context.SavedQuestions.Remove(question);
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error deleting question: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> UpdateSavedQuestionAsync(int id, int userId, CreateSavedQuestionDto dto)
    {
        try
        {
            var question = await _context.SavedQuestions
                .FirstOrDefaultAsync(q => q.Id == id && q.UserId == userId);

            if (question == null) return false;

            question.Name = dto.Name;
            question.Type = dto.Type;
            question.Query = dto.Query;
            question.TableName = dto.TableName;
            question.GroupBy = dto.GroupBy;
            question.Metric = dto.Metric;
            question.MetricColumn = dto.MetricColumn;
            question.ChartType = dto.ChartType;
            question.ConnectionId = dto.ConnectionId;
            question.ConnectionName = dto.ConnectionName;
            question.FiltersJson = dto.Filters != null ? JsonSerializer.Serialize(dto.Filters) : null;
            question.SelectedColumnsJson = dto.SelectedColumns != null ? JsonSerializer.Serialize(dto.SelectedColumns) : null;

            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error updating question: {ex.Message}");
            return false;
        }
    }
}