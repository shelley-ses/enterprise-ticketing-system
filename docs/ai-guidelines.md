# AI Developer Guidelines & Coding Invariants

This guide defines the explicit rules, architectural invariants, code conventions, and prohibited practices that any **AI Coding Assistant** (or human engineer) must follow when contributing to the **Enterprise Ticketing System**.

---

## 1. Core Architectural Invariants

### Invariant 1: Microservice Boundary Discipline
* **Never couple services directly at the database level**: Although microservices share a physical MySQL instance for operational simplicity, each service must only read and write to the tables within its bounded context.
* When `ticket-service` requires customer information, it must rely on customer attributes stored in its local snapshot or communicate via API.
* Real-time chat data must strictly reside in **MongoDB 7** (`messaging-service`). Do not introduce chat message tables into MySQL.

### Invariant 2: Cryptographic & Auth Invariants
* **Never transmit plaintext passwords**: All login, password change, and password reset payloads on the frontend must pass through `encryptPayload()` in `frontend/web/src/utils/rsa.js` before transit.
* **Never bypass `decrypt.rsa` middleware**: Backend routes receiving credentials must declare the `decrypt.rsa` middleware to handle decryption before standard validation runs.
* **Respect the Dual-Token Architecture**: Consumer services must utilize `AuthenticateSubsystem` to validate both central employee JWTs (with Redis blacklist checks) and customer Passport tokens.

### Invariant 3: Antivirus & File Attachment Integrity
* **Never bypass ClamAV**: Every file upload must be streamed to the ClamAV daemon (`capstone-clamav:3310`) before permanent persistence.
* Infected files must be deleted immediately from disk and rejected with an HTTP `422 Unprocessable Entity`.
* All stored filenames must be sanitized (`basename(preg_replace('/[^a-zA-Z0-9_.-]/', '_', $origName))`) and prefixed with a UUID.

### Invariant 4: Cache Consistency & Non-Blocking Invalidation
* `ticket-service` relies heavily on Redis for query caching. When modifying ticket state, status, or assignment, you **must invalidate associated cache patterns**.
* **Never use blocking `KEYS *`**: Always use the non-blocking `SCAN` iteration pattern implemented in `TicketController::clearTicketCaches()` to prevent freezing Redis in production.

---

## 2. Backend Coding Standards (Laravel / PHP 8.2)

### 1. Controller Hygiene & Refactoring Direction
* `TicketController.php` is excessively large (3,800+ lines). **Do not append large monolithic methods to it**.
* When adding significant new functionality, create dedicated service classes inside `app/Services/` (e.g., `App\Services\TicketCreationService`) and inject them into the controller.

### 2. Migrations & Database Changes
* Every schema change must be introduced via a timestamped Laravel migration (`database/migrations/YYYY_MM_DD_HHMMSS_*.php`).
* Foreign keys to `tickets.id` in compliance or audit tables (`ticket_audit_logs`) must be nullable and non-cascading so that historical audit trails survive ticket archival.
* Compound indexes must be added for high-frequency filter pairs (e.g., `['is_active', 'employee_id']` on `ticket_assignments`).

### 3. Asynchronous Events & WebSockets
* When a ticket transitions state, dispatch the `TicketChanged` event to notify all connected agents in real-time.
* When a message is sent or updated, broadcast the event on the presence channel `presence-ticket-chat.{ticket_id}`.

---

## 3. Frontend Coding Standards (React 19 / Tailwind v4)

### 1. Dual-Mode Deployment Awareness
* The frontend codebase (`frontend/web`) runs in two modes:
  * `VITE_APP_MODE="employee"` (Base path: `/ticketing/`, Port: 5005).
  * `VITE_APP_MODE="customer"` (Base path: `/customer-ticketing/` or `/`, Port: 5006).
* **Never break one mode when editing the other**. Ensure route guards and conditional rendering respect `import.meta.env.VITE_APP_MODE`.

### 2. State & Styling Conventions
* Use **Tailwind CSS v4** utility classes. Avoid inline style objects unless calculating dynamic positioning or dimensions.
* Use **Lucide React** (`lucide-react`) for all UI icons to preserve visual cohesion.
* Ensure all interactive buttons, inputs, and modal triggers have descriptive `id` or `data-testid` attributes for automated browser testing.

### 3. API Communication & Error Handling
* All HTTP requests must use the pre-configured Axios instance (`@/api/axiosInstance`).
* Never suppress API errors silently; display user-friendly toast notifications or inline alerts using the existing notification toast context.

---

## 4. Prohibited Anti-Patterns (AI "Do Not" List)

1. ❌ **DO NOT hardcode credentials, IP addresses, or secrets** in source code. Always use `env()` on the backend and `import.meta.env` on the frontend.
2. ❌ **DO NOT drop or truncate MySQL databases** during migration troubleshooting. Use rollback or targeted drop statements.
3. ❌ **DO NOT remove or comment out existing docstrings, PHPDoc blocks, or comments** unless they are directly made obsolete by your code change.
4. ❌ **DO NOT modify `nginx.conf` or `nginx.prod.conf` without testing both FastCGI and WebSocket routing**.
5. ❌ **DO NOT commit temporary test files, dump logs, or `.env` files** containing sensitive secrets.
