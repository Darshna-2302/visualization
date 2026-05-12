using System;
using BIApp.Core.Interfaces;
using BIApp.Core.Models;
using BIApp.Infrastructure.Data;
using BIApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp",
        builder =>
        {
            builder.WithOrigins("http://localhost:4200")
                   .AllowAnyHeader()
                   .AllowAnyMethod();
        });
});

// Configure EF Core with SQLite for local development (internal database)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=biapp.db"));

// Register Services
builder.Services.AddScoped<IDbConnectionService, DbConnectionService>();
builder.Services.AddScoped<IQueryExecutionService, QueryExecutionService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ISavedQuestionService, SavedQuestionService>();

// Configure JWT authentication (simple local/dev setup)
var jwtKey = "this_is_a_very_secret_key_for_jwt_auth_must_be_long_enough";
var keyBytes = Encoding.UTF8.GetBytes(jwtKey);
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        };
    });

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Auto-create database
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.EnsureCreated();

    // Seed a default development user if none exist (username: nambukamali / password: 123456)
    try
    {
            if (!dbContext.Users.Any())
        {
            // SHA256("123456") = 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
            dbContext.Users.Add(new User
            {
                Username = "nambukamali",
                PasswordHash = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
                Role = "Admin"
            });
            dbContext.SaveChanges();
            Console.WriteLine("Seeded default user: nambukamali / 123456 (hashed)");
        }
    }
    catch
    {
        // ignore seeding errors in dev
    }

    // Ensure the `Provider` column exists on DbConnections for older databases
    try
    {
        var connection = dbContext.Database.GetDbConnection();
        connection.Open();
        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "PRAGMA table_info('DbConnections');";
            using var reader = cmd.ExecuteReader();
            var hasProvider = false;
            var hasUserId = false;
            while (reader.Read())
            {
                var nameOrdinal = reader.GetOrdinal("name");
                var colName = reader.GetString(nameOrdinal);
                if (string.Equals(colName, "Provider", StringComparison.OrdinalIgnoreCase))
                {
                    hasProvider = true;
                    break;
                }
            }

            // Re-run reader to check for UserId column
            reader.Close();
            cmd.CommandText = "PRAGMA table_info('DbConnections');";
            using var reader2 = cmd.ExecuteReader();
            while (reader2.Read())
            {
                var nameOrdinal2 = reader2.GetOrdinal("name");
                var colName2 = reader2.GetString(nameOrdinal2);
                if (string.Equals(colName2, "Provider", StringComparison.OrdinalIgnoreCase))
                    hasProvider = true;
                if (string.Equals(colName2, "UserId", StringComparison.OrdinalIgnoreCase))
                    hasUserId = true;
            }

            if (!hasProvider)
            {
                using var alter = connection.CreateCommand();
                alter.CommandText = "ALTER TABLE DbConnections ADD COLUMN Provider TEXT DEFAULT 'SqlServer';";
                alter.ExecuteNonQuery();
            }

            if (!hasUserId)
            {
                using var alter2 = connection.CreateCommand();
                alter2.CommandText = "ALTER TABLE DbConnections ADD COLUMN UserId INTEGER NULL;";
                alter2.ExecuteNonQuery();
            }
        }
    }
    catch
    {
        // If anything goes wrong here, don't crash the app startup — migrations/manual fix can be applied by the developer.
    }

    // Ensure SavedQuestions table has newer columns for older DB files
    try
    {
        var connection = dbContext.Database.GetDbConnection();
        connection.Open();
        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "PRAGMA table_info('SavedQuestions');";
            using var reader = cmd.ExecuteReader();
            var hasChartType = false;
            var hasFiltersJson = false;
            var hasSelectedColumnsJson = false;
            var hasTableName = false;
            var hasUserIdSq = false;
            var hasConnectionId = false;
            var hasConnectionName = false;

            while (reader.Read())
            {
                var nameOrdinal = reader.GetOrdinal("name");
                var colName = reader.GetString(nameOrdinal);
                if (string.Equals(colName, "ChartType", StringComparison.OrdinalIgnoreCase))
                    hasChartType = true;
                if (string.Equals(colName, "FiltersJson", StringComparison.OrdinalIgnoreCase))
                    hasFiltersJson = true;
                if (string.Equals(colName, "SelectedColumnsJson", StringComparison.OrdinalIgnoreCase))
                    hasSelectedColumnsJson = true;
                if (string.Equals(colName, "TableName", StringComparison.OrdinalIgnoreCase))
                    hasTableName = true;
                if (string.Equals(colName, "UserId", StringComparison.OrdinalIgnoreCase))
                    hasUserIdSq = true;
            }

            if (!hasChartType)
            {
                using var alter = connection.CreateCommand();
                alter.CommandText = "ALTER TABLE SavedQuestions ADD COLUMN ChartType TEXT NULL;";
                alter.ExecuteNonQuery();
            }

            if (!hasFiltersJson)
            {
                using var alter2 = connection.CreateCommand();
                alter2.CommandText = "ALTER TABLE SavedQuestions ADD COLUMN FiltersJson TEXT NULL;";
                alter2.ExecuteNonQuery();
            }

            if (!hasSelectedColumnsJson)
            {
                using var alter3 = connection.CreateCommand();
                alter3.CommandText = "ALTER TABLE SavedQuestions ADD COLUMN SelectedColumnsJson TEXT NULL;";
                alter3.ExecuteNonQuery();
            }

            if (!hasTableName)
            {
                using var alter4 = connection.CreateCommand();
                alter4.CommandText = "ALTER TABLE SavedQuestions ADD COLUMN TableName TEXT DEFAULT '';";
                alter4.ExecuteNonQuery();
            }

            if (!hasConnectionId)
            {
                using var alterConnId = connection.CreateCommand();
                alterConnId.CommandText = "ALTER TABLE SavedQuestions ADD COLUMN ConnectionId INTEGER NULL;";
                alterConnId.ExecuteNonQuery();
            }

            if (!hasConnectionName)
            {
                using var alterConnName = connection.CreateCommand();
                alterConnName.CommandText = "ALTER TABLE SavedQuestions ADD COLUMN ConnectionName TEXT NULL;";
                alterConnName.ExecuteNonQuery();
            }

            if (!hasUserIdSq)
            {
                using var alter5 = connection.CreateCommand();
                alter5.CommandText = "ALTER TABLE SavedQuestions ADD COLUMN UserId INTEGER NULL;";
                alter5.ExecuteNonQuery();
            }
            // Add optional columns that may be present in newer model
            // GroupBy, Metric, MetricColumn
            if (!ColumnExists(connection, "SavedQuestions", "GroupBy"))
            {
                using var alter6 = connection.CreateCommand();
                alter6.CommandText = "ALTER TABLE SavedQuestions ADD COLUMN GroupBy TEXT NULL;";
                alter6.ExecuteNonQuery();
            }

            if (!ColumnExists(connection, "SavedQuestions", "Metric"))
            {
                using var alter7 = connection.CreateCommand();
                alter7.CommandText = "ALTER TABLE SavedQuestions ADD COLUMN Metric TEXT NULL;";
                alter7.ExecuteNonQuery();
            }

            if (!ColumnExists(connection, "SavedQuestions", "MetricColumn"))
            {
                using var alter8 = connection.CreateCommand();
                alter8.CommandText = "ALTER TABLE SavedQuestions ADD COLUMN MetricColumn TEXT NULL;";
                alter8.ExecuteNonQuery();
            }
        }
    }
    catch
    {
        // ignore — developer can run proper migrations if needed
    }

    // helper to check column exists
    static bool ColumnExists(System.Data.Common.DbConnection connection, string table, string column)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = $"PRAGMA table_info('{table}');";
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var nameOrdinal = reader.GetOrdinal("name");
            var colName = reader.GetString(nameOrdinal);
            if (string.Equals(colName, column, StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }
}

app.UseCors("AllowAngularApp");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
