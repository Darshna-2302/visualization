using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BIApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedQuestionsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DbConnections",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Server = table.Column<string>(type: "TEXT", nullable: false),
                    Database = table.Column<string>(type: "TEXT", nullable: false),
                    Username = table.Column<string>(type: "TEXT", nullable: false),
                    Password = table.Column<string>(type: "TEXT", nullable: false),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    Provider = table.Column<string>(type: "TEXT", nullable: false),
                    Port = table.Column<int>(type: "INTEGER", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    OwnerUsername = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DbConnections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Username = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
                    Role = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SavedQuestions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    QuestionText = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    Query = table.Column<string>(type: "TEXT", nullable: false),
                    ResultSummary = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: false),
                    SavedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SavedQuestions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SavedQuestions_UserId",
                table: "SavedQuestions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DbConnections");

            migrationBuilder.DropTable(
                name: "SavedQuestions");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
