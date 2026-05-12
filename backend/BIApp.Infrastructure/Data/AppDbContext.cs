using Microsoft.EntityFrameworkCore;
using BIApp.Core.Models;

namespace BIApp.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }
    
    public DbSet<User> Users { get; set; }
    public DbSet<SavedQuestion> SavedQuestions { get; set; }
    public DbSet<DbConnectionConfig> DbConnections { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configure SavedQuestion
        modelBuilder.Entity<SavedQuestion>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200).HasColumnName("QuestionText");
            entity.Property(e => e.Type).HasMaxLength(20).HasColumnName("Category");
            entity.Property(e => e.Query).IsRequired().HasColumnName("Query");
            entity.Property(e => e.TableName).HasMaxLength(100).HasColumnName("TableName");
            entity.Property(e => e.GroupBy).HasMaxLength(100).HasColumnName("GroupBy");
            entity.Property(e => e.Metric).HasMaxLength(20).HasColumnName("Metric");
            entity.Property(e => e.MetricColumn).HasMaxLength(100).HasColumnName("MetricColumn");
            entity.Property(e => e.ChartType).HasMaxLength(20).HasColumnName("ChartType");
            entity.Property(e => e.FiltersJson).HasColumnName("FiltersJson");
            entity.Property(e => e.SelectedColumnsJson).HasColumnName("SelectedColumnsJson");
            entity.Property(e => e.CreatedAt).HasColumnName("SavedAt");
            
            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
        
        // Configure User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
            entity.Property(e => e.PasswordHash).IsRequired();
            entity.Property(e => e.Role).HasMaxLength(50);
            
            entity.HasIndex(e => e.Username).IsUnique();
        });
        
        base.OnModelCreating(modelBuilder);
    }
}