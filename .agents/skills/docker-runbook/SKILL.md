---
name: docker-runbook
description: Manage, debug, and run commands across the multi-container Docker Compose environment. Use when executing database migrations, reviewing service logs, restarting daemons (ClamAV, Reverb), or troubleshooting container networking.
---

# Docker Runbook & Container Operations

This skill outlines operational procedures and common commands for managing the multi-container microservice stack defined in `docker-compose.yml`.

## 1. Container Topology

| Service Container | Port Mapping | Description |
| :--- | :--- | :--- |
| `nginx-gateway` | 80, 443 | Reverse proxy gateway routing `/api/*` and serving static frontend |
| `frontend-web` | 5005, 5006 | Vite React development server |
| `ticketing-service` | 8001:8000 | Ticketing core, SLA engine |
| `auth-service` | 8002:8000 | Authentication, Passport, RSA decryptor |
| `asset-service` | 8003:8000 | Asset management service |
| `attachment-service` | 8004:8000 | Uploads & ClamAV scanner client |
| `audit-service` | 8005:8000 | Audit trail logger |
| `notification-service`| 8006:8000 | Email and notification worker |
| `ai-service` | 8008:8000 | Google Gemini 2.0 Flash AI assistant |
| `mysql` | 3306:3306 | Per-service MySQL databases |
| `redis` | 6379:6379 | Redis cache & session store |
| `capstone-clamav` | 3310:3310 | ClamAV antivirus daemon |
| `reverb` | 6001:6001 | Laravel Reverb WebSocket server |

---

## 2. Microservice Database Migrations

To execute migrations inside a specific microservice container:

```bash
# Run migration for AI Service
docker compose exec ai-service php artisan migrate

# Run migration for Ticketing Service
docker compose exec ticketing-service php artisan migrate

# Run migration for Auth Service
docker compose exec auth-service php artisan migrate

# Run migration for Attachment Service
docker compose exec attachment-service php artisan migrate
```

To run all microservice migrations in sequence:
```bash
$services = @("auth-service", "ticketing-service", "asset-service", "attachment-service", "audit-service", "notification-service", "ai-service")
foreach ($s in $services) {
    docker compose exec $s php artisan migrate --force
}
```

---

## 3. Running Microservice Test Suites

Execute PHPUnit / Pest tests inside any microservice:

```bash
# Test Ticketing Service
docker compose exec ticketing-service php artisan test

# Test AI Service
docker compose exec ai-service php artisan test

# Test Auth Service
docker compose exec auth-service php artisan test
```

---

## 4. ClamAV Antivirus Daemon Operations

* **Status Check**: Verify the ClamAV daemon is listening on port 3310:
  ```bash
  docker compose logs -f capstone-clamav
  ```
* **Test Antivirus Detection**: In `attachment-service`, submit the standard EICAR test string:
  ```text
  X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
  ```
  The attachment service must reject the upload with HTTP 422 Unprocessable Entity and immediately delete the temp file.

---

## 5. Nginx Gateway Troubleshooting

* **Test Nginx Configuration**:
  ```bash
  docker compose exec nginx nginx -t
  ```
* **Hot Reload Routing**:
  ```bash
  docker compose exec nginx nginx -s reload
  ```
* **View Gateway Access & Error Logs**:
  ```bash
  docker compose logs -f nginx
  ```

---

## 6. Real-Time Reverb WebSocket Operations

* **Check Reverb Process**:
  ```bash
  docker compose exec notification-service php artisan reverb:status
  ```
* **Restart Reverb Server**:
  ```bash
  docker compose restart reverb
  ```
