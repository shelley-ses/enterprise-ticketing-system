---
name: laravel-microservice
description: Scaffold, modify, and extend Laravel 10/11 microservices in services/. Use when adding database migrations, Eloquent models, controllers, services, routes, or inter-service API integrations.
---

# Laravel Microservice Development Guide

This skill governs development across the 7 backend Laravel microservices located in `services/`:

| Microservice | Port | Primary Responsibility | Key Dependencies |
| :--- | :--- | :--- | :--- |
| `AI-service` | 8008 | Google Gemini Flash automated support & triage | Google Gemini API, MySQL |
| `ticketing-service` | 8001 | Tickets, SLA timers, status state machines | MySQL, Redis, Reverb |
| `auth-service` | 8002 | JWT issuance, RBAC, RSA decryption | Laravel Passport, RSA Keypair |
| `asset-service` | 8003 | Hardware/software inventory & lifecycle | MySQL |
| `attachment-service` | 8004 | File uploads, S3 storage, ClamAV antivirus | ClamAV Daemon (port 3310) |
| `audit-service` | 8005 | Immutable audit trail & compliance logging | MySQL (append-only) |
| `notification-service` | 8006 | Reverb WebSockets & email dispatch | Laravel Reverb (port 6001) |

---

## 1. Creating Database Migrations

Always generate timestamped migrations within the target service directory:

```bash
docker compose exec <service-name> php artisan make:migration create_<table_name>_table
```

### Migration Rules & Standards:
* **Foreign Keys**: Always use `$table->unsignedBigInteger('...')` with indexed columns.
* **Audit Foreign Keys**: In `audit-service` and audit logs, foreign keys must remain **nullable and non-cascading** (`->nullable()->nullOnDelete()`) so deleted records preserve historical audit logs.
* **Timestamps**: Always use `$table->timestamps()` and add indexes on fields frequently queried in ranges (e.g. `$table->index('created_at')`).
* **JSON Columns**: For unstructured data (such as chat histories, escalation metadata, or snapshot state), use `$table->json('messages')`.

---

## 2. Model & Service Conventions

### Thin Controllers, Rich Services:
* Controllers (`app/Http/Controllers/`) must solely validate incoming requests, invoke a Service class, and format the JSON response.
* Business logic belongs in `app/Services/` (e.g., `TicketService`, `GeminiService`, `AuditLogger`).

### Model Standards:
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ExampleModel extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'title',
        'status',
        'payload',
    ];

    protected $casts = [
        'payload' => 'array',
        'resolved_at' => 'datetime',
    ];
}
```

---

## 3. Inter-Service Communication & Auth

* **Subsystem Authentication**: Downstream services (`ticketing-service`, `AI-service`, etc.) verify callers using the shared public key (`storage/oauth-public.key`) via the `auth.subsystem` middleware.
* **Inter-Service HTTP Requests**:
  ```php
  use Illuminate\Support\Facades\Http;

  $response = Http::withToken($userJwtToken)
      ->timeout(5)
      ->post('http://ticket-service:8000/api/tickets', [
          'title' => $title,
          'description' => $description,
      ]);
  ```

---

## 4. Redis Caching & Invalidation Patterns

* **Non-Blocking Invalidation**: NEVER execute `Redis::keys('*')` as it blocks single-threaded Redis in high-throughput environments.
* Always wrap Redis operations in try-catch blocks to prevent cache outages from taking down API requests.
* Use non-blocking scan chunking:
  ```php
  public function clearCaches(string $pattern = 'ticket:*'): void
  {
      try {
          $cursor = 0;
          do {
              [$cursor, $keys] = Redis::scan($cursor, ['match' => $pattern, 'count' => 100]);
              if (!empty($keys)) {
                  Redis::del($keys);
              }
          } while ($cursor != 0);
      } catch (\Exception $e) {
          Log::warning('Redis cache clearing failed: ' . $e->getMessage());
      }
  }
  ```

---

## 5. Route Definition & Nginx Gateway Parity

1. Register API endpoints in `services/<service-name>/routes/api.php`.
2. All endpoints in microservices receive requests proxied by Nginx:
   * `/api/tickets/*` -> `ticketing-service:8000`
   * `/api/auth/*` -> `auth-service:8000`
   * `/api/assets/*` -> `asset-service:8000`
   * `/api/attachments/*` -> `attachment-service:8000`
   * `/api/audit/*` -> `audit-service:8000`
   * `/api/notifications/*` -> `notification-service:8000`
   * `/api/ticketing/ai/*` -> `AI-service:8000`
3. If introducing a new route prefix, update both `nginx/nginx.conf` and `nginx/nginx.prod.conf`.
