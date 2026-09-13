# Docker & Container Orchestration

This guide documents the container architecture, orchestration manifests, network topology, and persistence layers powering the **Enterprise Ticketing System**.

---

## Container Architecture Overview

The system runs as an orchestrated multi-container application managed through Docker Compose.

```
+---------------------------------------------------------------------------------------------------+
|                                      FRONTEND CONTAINERS                                          |
|  - ticketing_web (Port 5005, Mode: Employee)      - customer_ticketing_web (Port 5006, Mode: Customer) |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+-------------------------------------------------+-------------------------------------------------+
|                                  BACKEND SERVICES & QUEUES                                        |
|  - customer-service (8001:8000)                   - customer-service-queue (Redis Worker)         |
|  - ticket-service (8002:8000)                     - ticket-service-queue (Redis Worker)           |
|  - attachment-service (8006:8000)                 - messaging-service (8007:8000)                 |
|  - analytics-service (8004:8000)                  - notification-service (8003:8000)              |
|  - ai-service (8005:8000)                                                                         |
+-------------------------------------------------+-------------------------------------------------+
         |                                        |                                        |
         v                                        v                                        v
+-----------------------+        +--------------------------------+        +------------------------+
| REAL-TIME WEBSOCKETS  |        |     DATA & PERSISTENCE         |        |   SECURITY ENGINE      |
| - capstone-reverb     |        | - capstone-db (MySQL 8: 33061) |        | - capstone-clamav      |
|   (Port 6001)         |        | - capstone-mongodb (Mongo: 27017)|       |   (ClamAV: 3310)       |
| - capstone-messaging- |        | - capstone-redis (Redis 7:6379)|        |                        |
|   reverb (Port 6002)  |        +--------------------------------+        +------------------------+
+-----------------------+
```

---

## Service Manifest Reference

### 1. Database & In-Memory Services
* **`db` (`capstone-db`)**:
  * **Image**: `mysql:8`
  * **Exposed Port**: `33061:3306`
  * **Command**: `--skip-name-resolve` (optimizes container DNS resolution)
  * **Healthcheck**: `mysqladmin ping -h localhost -p${MYSQL_ROOT_PASSWORD}` (10s interval, 10 retries)
  * **Volume**: `db_data:/var/lib/mysql`
* **`redis` (`capstone-redis`)**:
  * **Image**: `redis:7` (or `redis:7-alpine` in prod)
  * **Exposed Port**: `6379:6379`
  * **Command**: `redis-server --appendonly yes`
  * **Volume**: `redis_data:/data`
* **`mongodb` (`capstone-mongodb`)**:
  * **Image**: `mongo:7.0.14`
  * **Exposed Port**: `27017:27017`
  * **Healthcheck**: `mongosh --eval "db.adminCommand('ping')"`
  * **Volume**: `mongodb_data:/data/db`
* **`clamav` (`capstone-clamav`)**:
  * **Image**: `clamav/clamav:stable`
  * **Exposed Port**: `3310:3310`
  * **Role**: On-demand antivirus scanning via TCP socket for file uploads.

### 2. Microservice Application Containers
All backend services share a standardized startup and bootstrap sequence in development:
1. Copy `.env.example` to `.env` if `.env` does not exist.
2. Install dependencies via Composer if `vendor/autoload.php` is missing.
3. Generate application key (`php artisan key:generate --force`) if empty.
4. Execute `php artisan storage:link --force` (where applicable).
5. Start the web server on port `8000`.

| Container | Host Port | Internal Port | Primary Volume Mount | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `customer-service` | `8001` | `8000` | `./services/customer-service:/var/www` | Central Auth & Identity |
| `customer-service-queue` | N/A | N/A | `./services/customer-service:/var/www` | Runs `queue:work redis` |
| `ticket-service` | `8002` | `8000` | `./services/ticket-service:/var/www` | Core Ticket Engine |
| `ticket-service-queue` | N/A | N/A | `./services/ticket-service:/var/www` | Runs `queue:work redis` |
| `notification-service` | `8003` | `8000` | `./services/notification-service:/var/www` | Notification Dispatcher |
| `analytics-service` | `8004` | `8000` | `./services/analytics-service:/var/www` | CSAT & Predictive Analytics |
| `ai-service` | `8005` | `8000` | `./services/AI-service:/var/www` | AI & LLM Triage Engine |
| `attachment-service` | `8006` | `8000` | `./services/attachment-service:/var/www` | Connects to ClamAV socket |
| `messaging-service` | `8007` | `8000` | `./services/messaging-service:/var/www` | Connects to MongoDB & Reverb |

### 3. Real-Time WebSockets Containers
* **`reverb` (`capstone-reverb`)**:
  * **Port**: `6001:6001`
  * **Command**: `php artisan reverb:start --host=0.0.0.0 --port=6001`
  * **Channels**: Ticket status updates, assignments, notifications.
* **`messaging-reverb` (`capstone-messaging-reverb`)**:
  * **Port**: `6002:6002`
  * **Command**: `php artisan reverb:start --host=0.0.0.0 --port=6002`
  * **Channels**: Chat conversation streams per ticket ID.

### 4. Frontend Containers
Both frontend containers are built from the same React source context (`./frontend/web`), but configured with distinct runtime environments:
* **`ticketing-frontend` (`ticketing_web`)**:
  * **Port**: `5005:5005`
  * **Environment**: `VITE_APP_MODE="employee"`, `VITE_BASE_PATH="/ticketing/"`
* **`customer-ticketing-frontend` (`customer_ticketing_web`)**:
  * **Port**: `5006:5006`
  * **Environment**: `VITE_APP_MODE="customer"`, `VITE_BASE_PATH="/customer-ticketing/"`

---

## Docker Networks

The Compose setup establishes isolated and shared bridge networks:
1. **`default`**: Automatic bridge network for container-to-container communication within the compose project.
2. **`shared-capstone-network`**: An external bridge network enabling cross-project communication between microservice containers and shared gateway proxies.
3. **`ai-ticketing-network`**: An external network designated for AI service extensions.

> [!TIP]
> If `shared-capstone-network` does not exist when running `docker compose up`, create it manually once:
> ```bash
> docker network create shared-capstone-network
> docker network create ai-ticketing-network
> ```

---

## Volume Persistence

| Volume Name | Target Path | Description |
| :--- | :--- | :--- |
| `db_data` | `/var/lib/mysql` | Persistent MySQL 8 database files |
| `redis_data` | `/data` | Redis AOF (Append-Only File) persistence |
| `mongodb_data` | `/data/db` | Persistent MongoDB 7 chat documents |
| `*-vendor` | `/var/www/vendor` | Named volumes to isolate Composer dependencies across host/guest |

---

## Common Docker Operational Commands

### Starting & Stopping
```bash
# Start all containers in background
docker compose up -d

# Start with build (recompiling Dockerfiles)
docker compose up -d --build

# Stop all containers (preserving volumes)
docker compose down

# Stop and remove all volumes (destructive reset)
docker compose down -v
```

### Viewing Logs
```bash
# View combined live log stream
docker compose logs -f

# View logs for a specific service
docker compose logs -f ticket-service
docker compose logs -f capstone-clamav
```

### Executing Commands Inside Containers
```bash
# Run migrations on ticket-service
docker compose exec ticket-service php artisan migrate

# Clear and rebuild cache on customer-service
docker compose exec customer-service php artisan cache:clear

# Open a shell inside the database container
docker compose exec db mysql -u root -p
```

---

## Production Optimization (`production-optimize.sh`)

In production environments (`docker-compose.prod.yml`), application containers run PHP-FPM behind Nginx. The `production-optimize.sh` script primes performance caches inside all running production containers:

```bash
chmod +x production-optimize.sh
./production-optimize.sh
```

**Actions Performed per Container**:
1. `php artisan config:cache`: Combines all configuration files into a single cached file.
2. `php artisan route:cache`: Pre-compiles route registrations for fast lookup.
3. `php artisan view:cache`: Pre-compiles Blade template files.
