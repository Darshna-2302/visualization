// BIApp.API/Controllers/SavedQuestionsController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using BIApp.Core.Interfaces;
using BIApp.Core.DTOs;

namespace BIApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SavedQuestionsController : ControllerBase
{
    private readonly ISavedQuestionService _savedQuestionService;

    public SavedQuestionsController(ISavedQuestionService savedQuestionService)
    {
        _savedQuestionService = savedQuestionService;
    }

    private int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim))
        {
            throw new UnauthorizedAccessException("User ID not found in token");
        }
        return int.Parse(userIdClaim);
    }

    [HttpGet]
    public async Task<IActionResult> GetMySavedQuestions()
    {
        try
        {
            var userId = GetUserId();
            var questions = await _savedQuestionService.GetUserSavedQuestionsAsync(userId);
            return Ok(questions);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { message = "Invalid or missing token" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error retrieving saved questions: {ex.Message}" });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetSavedQuestion(int id)
    {
        try
        {
            var userId = GetUserId();
            var question = await _savedQuestionService.GetSavedQuestionByIdAsync(id, userId);
            
            if (question == null)
                return NotFound(new { message = "Saved question not found" });
                
            return Ok(question);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { message = "Invalid or missing token" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error retrieving saved question: {ex.Message}" });
        }
    }

    [HttpPost]
    public async Task<IActionResult> SaveQuestion([FromBody] CreateSavedQuestionDto dto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetUserId();
            var question = await _savedQuestionService.SaveQuestionAsync(userId, dto);
            return CreatedAtAction(nameof(GetSavedQuestion), new { id = question.Id }, question);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { message = "Invalid or missing token" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error saving question: {ex.Message}" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSavedQuestion(int id)
    {
        try
        {
            var userId = GetUserId();
            var result = await _savedQuestionService.DeleteSavedQuestionAsync(id, userId);
            
            if (!result)
                return NotFound(new { message = "Saved question not found" });
                
            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { message = "Invalid or missing token" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error deleting question: {ex.Message}" });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateSavedQuestion(int id, [FromBody] CreateSavedQuestionDto dto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetUserId();
            var result = await _savedQuestionService.UpdateSavedQuestionAsync(id, userId, dto);
            
            if (!result)
                return NotFound(new { message = "Saved question not found" });
                
            return Ok(new { message = "Question updated successfully" });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { message = "Invalid or missing token" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error updating question: {ex.Message}" });
        }
    }
}