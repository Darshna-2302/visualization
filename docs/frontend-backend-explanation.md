Overview

This document explains the frontend and backend in this workspace (what starts, why each major file/module exists, and a step-by-step startup/interaction flow). Use this as a quick reference for developers onboarding or debugging.

Contents
- Quick start (what to run)
- Backend overview (projects, key files, responsibilities)
- Backend startup & request flow (step-by-step)
- Frontend overview (folders, key files, responsibilities)
- Frontend startup & runtime flow (step-by-step)
- Why these pieces are used (design rationale)
- Next steps / verification checklist

Quick start

1. Start the backend API (dotnet):

   dotnet run --project BIApp.API --launch-profile http

2. Start the frontend (Angular):

   cd frontend
   npm install
   npm start   # or `ng serve` depending on your scripts

Backend overview

Projects:
- BIApp.API: ASP.NET Core Web API that exposes endpoints for authentication, managing DB connections, executing queries, and serving metadata (tables/columns).
- BIApp.Core: Shared domain models and interfaces (e.g., `DbConnectionConfig`, DTOs). Used by API and Infrastructure.
- BIApp.Infrastructure: Implementation of services (database access, AuthService, DbConnectionService, QueryExecutionService) and EF Core `AppDbContext`.

Key files and roles:
- Program.cs (BIApp.API)
  - Registers services, DI, CORS, Swagger, JWT authentication, and performs startup checks (ensure database created; adds missing columns like `Provider` and `OwnerUsername` for older SQLite DBs).
  - Why: central application bootstrap — config + middleware. Startup checks keep the app resilient when schema changes are introduced.

- appsettings.json (BIApp.API)
  - Contains ConnectionStrings and `BuiltinConnection` configuration (demo connection metadata and sample table list).
  - Why: make the demo/builtin connection configurable rather than hard-coded.

- AppDbContext.cs (BIApp.Infrastructure/Data)
  - EF Core DbContext defining the app's persistent tables (Users, DbConnections, SavedQueries, Dashboards).
  - Why: EF simplifies local persistence, seeding admin user, and change tracking.

- Models (BIApp.Core/Models)
  - `DbConnectionConfig`: represents a saved external data source (host, db, username, password, Provider, OwnerUsername, CreatedAt, etc.).
  - Why: central model shared across layers; adding `Provider` allows provider-aware execution and `OwnerUsername` ties connections to specific users.

- Services (BIApp.Infrastructure/Services)
  - `AuthService`: authenticates users and issues JWT tokens. Adds `ClaimTypes.Name` to token for `OwnerUsername` mapping.
  - `DbConnectionService`: CRUD for persisted connections in the app DB, tests connections, and fetches tables for live connections (provider-aware using MySqlClient / SqlClient). Contains logic to protect built-in, and to return tables for UI listing.
  - `QueryExecutionService`: executes arbitrary (safe) queries against external connections using provider-specific clients (MySQL or SQL Server), normalizes output into `QueryResult` (columns, rows, executionTimeMs, rowCount), and provides metadata (tables/columns).
  - Why: separation of concerns (persistence vs execution) keeps code testable and maintainable; provider-aware implementations let the app run queries against different DB engines.

- Controllers (BIApp.API/Controllers)
  - `AuthController`: login endpoint returning JWTs.
  - `DbConnectionController`: endpoints to list/create/test/delete connections and to get tables; now reads builtin connection from config and respects `OwnerUsername`.
  - `QueryController`: executes queries and returns normalized `QueryResult` JSON; returns builtin sample data (from config) for the demo connection id.
  - Why: controllers expose a clean REST API for the frontend and ensure consistent normalization of responses.

Backend startup & request flow (step-by-step)
1. Program.cs runs; services are registered and DI container built.
2. `AppDbContext.Database.EnsureCreated()` ensures SQLite `biapp.db` exists.
3. Startup code connects to SQLite and verifies columns (`Provider`, `OwnerUsername`) exist; if missing, runs ALTER TABLE to add them (backwards compatibility).
4. JWT auth is configured so controllers can read authenticated `User.Identity.Name` from requests.
5. When a client (frontend) calls `GET /api/DbConnection`:
   - Controller loads all persisted connections from `DbConnectionService.GetAllAsync()`.
   - It filters connections to return global ones (no owner) and those owned by the current logged-in user.
   - It reads builtin info from `appsettings.json` and includes the builtin entry if no persisted connection uses the builtin id.
6. When creating a connection (`POST /api/DbConnection`): the controller sets `OwnerUsername` from `User.Identity.Name` (if authenticated), tests the connection (via `DbConnectionService.TestConnectionAsync`), and persists it.
7. When executing a query (`POST /api/Query/run`):
   - If the requested connection id matches the builtin id (from config) and that connection isn't persisted, the API serves a small sample schema (in-memory).
   - Otherwise, the API uses `QueryExecutionService.ExecuteQueryAsync` which opens a provider-specific DB connection, runs the query (SELECT-only guard), and returns a normalized `QueryResult`.

Frontend overview

Structure (important files/folders under `frontend/src/app`):
- services/
  - `api.ts`: HTTP wrapper that attaches JWT `Authorization` header and provides methods to call backend endpoints (`getConnections`, `createConnection`, `testConnection`, `deleteConnection`, `runQuery`, `getTables`, `getColumns`).
  - `auth.ts`: manages login, token storage (localStorage `token`), and provides `getToken()` for `ApiService` to include in headers.
  - `database.service.ts`: local caching and higher-level logic for connections and schemas. It maintains built-in sample data for offline fallback and merges backend responses into the local cache. It exposes `activeConnection$` observable for components.
- components/
  - `connections/` (ConnectionsComponent): UI to list, add, delete, and set active connections. It calls `DatabaseService` and shows tables counts.
  - `browser-data/`, `query-builder/`, `query-editor/`, etc.: components that let users browse tables, build queries, and visualize data. They rely on `DatabaseService` to fetch tables and run queries.
- models/
  - `database.models.ts`: TypeScript interfaces representing `DatabaseConnection`, `QueryResult`, etc.

Why these parts are used (frontend rationale)
- `ApiService`: centralizes HTTP calls and header handling (JWT) so other services/components don't duplicate auth logic.
- `AuthService`: handles login and token lifecycle so the app can persist session state across reloads.
- `DatabaseService`: acts as an offline-capable cache layer — it first tries the backend and falls back to built-in sample data if backend is unreachable. It also normalizes how components consume connection metadata and query results.
- Components: each UI responsibility is isolated (connections management vs data browsing vs query editing), making maintenance and testing easier.

Frontend runtime flow (step-by-step)
1. App initializes; `AuthService` reads localStorage for a token and sets authentication state.
2. `ConnectionsComponent.ngOnInit()` calls `DatabaseService.getConnections()` which invokes `ApiService.getConnections()`.
3. `ApiService` attaches `Authorization: Bearer <token>` header; backend authenticates request and returns connections filtered for the current user plus the builtin configured demo.
4. The UI shows the list; built-in connections have `builtin: true` so the delete button is hidden (guard in template). Persisted connections can be deleted only if owned by the current user.
5. When the user runs a query, `DatabaseService.executeQuery()` calls `ApiService.runQuery()`; results are normalized to `{ columns, rows, executionTime, rowCount }` and presented to UI components.

Why these pieces are used (design rationale)
- JWT authentication: stateless, simple for single-page apps; tokens stored in localStorage (suitable for demo; in production consider stronger protections).
- SQLite + EF Core: easy local persistence for app settings, users, saved queries, and connections without requiring an external DB for the management plane.
- Provider-aware execution: storing `Provider` lets the server choose appropriate client (MySqlClient vs SqlClient) and SQL dialect-aware metadata queries.
- Normalized `QueryResult`: the frontend expects a consistent shape regardless of underlying DB — columns (names), rows (array of row objects), executionTime, rowCount — simplifies UI rendering.
- Builtin demo from config: configurable sample data ensures consistent UX (demo always present) and avoids accidental deletion; making it configurable lets you change sample tables/values without code edits.
- `OwnerUsername`: simple ownership model that ties saved connections to the creating user; protects other users' connections and supports multi-tenant behavior.

Next steps / verification checklist
- Start backend, then frontend; log in via `Auth` UI to obtain a token and check `DbConnection` listing returns builtin + any owned connections.
- Create a new connection (valid credentials) and verify it is persisted and shows under the same user only.
- Try to delete a connection owned by someone else (if you have multiple users) to confirm the API forbids it.
- Run a query against the builtin (demo) connection id (configured in `appsettings.json`) and observe sample rows.

If you want, I can:
- Seed the builtin into the SQLite DB (so it becomes a persisted, protected row),
- Add role-based checks (admin can see/delete all connections), or
- Expand `QueryExecutionService` to support more providers.


Folder- BIApp.API
have controller:
              -authcontroller
              -db connection controller
              -query controller
      properties:
              -launchSetting.json here defined backend http and https port
            -appSettings.json congifuration string mysql connection to be added with server,password,root
      





---
File location: docs/frontend-backend-explanation.md
