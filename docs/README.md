# Enterprise Ticketing System Documentation

Welcome to the centralized engineering and architectural documentation for the **Enterprise Ticketing System**. This system is an enterprise-grade, distributed microservices platform built for multi-tenant customer support, field engineer dispatch, SLA management, real-time messaging, and predictive analytics.

---

## Documentation Navigation

This documentation suite is organized into focused, modular domain guides:

| Document | Description |
| :--- | :--- |
| **[Architecture Guide](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/docs/architecture.md)** | System topology, microservice boundaries, synchronous vs. asynchronous data flows, and Nginx gateway routing. |
| **[Tech Stack Reference](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/docs/tech-stack.md)** | Comprehensive inventory of backend runtimes, frontend libraries, databases, caching layers, and protocols. |
| **[Docker & DevOps](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/docs/docker.md)** | Docker Compose orchestration, dev vs. prod configurations, networks, volumes, environment variables, and tuning. |
| **[Business Rules & Workflows](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/docs/business-rules.md)** | Complete ticket lifecycle state machine, SLA calculation rules, escalation paths, RBAC matrix, and proof-of-work logic. |
| **[Security Architecture](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/docs/security.md)** | End-to-end RSA client-side payload encryption, OAuth2 public-key token verification, ClamAV antivirus pipelines, and rate limiting. |
| **[API & Event Contracts](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/docs/api-contracts.md)** | Nginx reverse proxy routing rules, REST API endpoint definitions per microservice, and WebSocket channels. |
| **[Database Schema & State](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/docs/database-schema.md)** | Relational MySQL 8 data structures, MongoDB 7 chat storage, and Redis caching key patterns and invalidation strategies. |
| **[Implementation Plan & Roadmap](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/docs/implementation-plan.md)** | Current subsystem maturity assessment, future roadmap (AI-service, notification engine), and standard feature template. |
| **[Troubleshooting & Operations Runbook](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/docs/troubleshooting.md)** | Step-by-step diagnostic workflows for container connection drops, ClamAV timeouts, Reverb WebSocket issues, and Nginx 502s. |
| **[AI Developer Guidelines](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/docs/ai-guidelines.md)** | Core invariants, coding conventions, testing expectations, and anti-patterns for AI pair programmers and human engineers. |

---

## High-Level System Overview

```
                          +------------------------------------------+
                          |        Client Browsers / SPAs            |
                          |  Customer Mode (5006) / Employee (5005)  |
                          +--------------------+---------------------+
                                               |
                                               v
                          +--------------------+---------------------+
                          |           Nginx API Gateway              |
                          |      (Port 80 HTTP / 443 HTTPS)          |
                          +----+---------------+---------------+-----+
                               |               |               |
        +----------------------+               |               +----------------------+
        | /api/ticketing/customer              | /app/*, /messaging-app/*             | /api/ticketing/ticket
        v                                      v                                      v
+------------------+                 +-------------------+                  +------------------+
| customer-service |                 |   Laravel Reverb  |                  |  ticket-service  |
| (Auth, Clients,  |                 | (WebSockets: 6001 |                  | (Core Tickets,   |
|  Employees)      |                 |  & 6002 Messaging)|                  |  SLAs, Audits)   |
+--------+---------+                 +---------+---------+                  +--------+---------+
         |                                     |                                     |
         +-----------------+                   |                   +-----------------+
                           |                   |                   |
                           v                   v                   v
                    +-----------------------------------------------------+
                    |           Infrastructure & Shared Services          |
                    |  - MySQL 8 (Relational DB on 3306)                  |
                    |  - Redis 7 (Cache, Queue, Sessions on 6379)         |
                    |  - MongoDB 7 (Chat & Message Store on 27017)        |
                    |  - ClamAV (Antivirus Engine on 3310)                |
                    |  - attachment-service (Scanned File Storage)        |
                    |  - analytics-service (CSAT & Predictive Metrics)    |
                    |  - notification-service (Email & Push Dispatcher)   |
                    |  - AI-service (LLM Triage & Sentiment Analysis)     |
                    +-----------------------------------------------------+
```

---

## Quickstart Guide

### Prerequisites
* Docker Engine 24.0+ and Docker Compose v2.20+
* Git
* Node.js 20+ (for direct local frontend development, optional if running via Docker)
* PHP 8.2+ and Composer 2.6+ (for direct local backend development, optional if running via Docker)

### Starting the Local Environment

1. **Clone the repository:**
   ```bash
   git clone <repo-url> enterprise-ticketing-system
   cd enterprise-ticketing-system
   ```

2. **Environment configuration:**
   Copy the root `.env.example` to `.env` and fill in the required environment variables:
   ```bash
   cp .env.example .env
   ```
   *(Ensure `MYSQL_ROOT_PASSWORD` and `MYSQL_DATABASE` match the service requirements).*

3. **Spin up containers:**
   ```bash
   docker compose up -d --build
   ```

4. **Verify running containers:**
   ```bash
   docker compose ps
   ```

5. **Access the Applications:**
   * **Customer Portal**: [http://localhost/](http://localhost/) (or direct dev port [http://localhost:5006/](http://localhost:5006/))
   * **Employee / Support Portal**: [http://localhost/ticketing/](http://localhost/ticketing/) (or direct dev port [http://localhost:5005/](http://localhost:5005/))
   * **API Gateway Entrypoint**: [http://localhost/api/ticketing/](http://localhost/api/ticketing/)

---

## Repository Structure

```
.
├── .agents/                    # Workspace agent rules & customizations
│   └── rules/
│       └── coding-standards.md # Enforced AI coding standards
├── docs/                       # Technical & architectural documentation suite
├── frontend/
│   └── web/                    # Single-Page React 19 application (Employee & Customer modes)
├── services/
│   ├── AI-service/             # AI integration microservice (LLM triage, knowledge base)
│   ├── analytics-service/      # CSAT feedback and predictive metrics microservice
│   ├── attachment-service/     # File uploads, ClamAV antivirus quarantine & storage
│   ├── customer-service/       # Auth, OAuth2 server, client provisioning, employee accounts
│   ├── messaging-service/      # Real-time chat microservice backed by MongoDB & Reverb
│   ├── notification-service/   # Email and notification distribution microservice
│   └── ticket-service/         # Core ticketing engine, SLA tracking, and audit logging
├── docker-compose.yml          # Local development container orchestration
├── docker-compose.prod.yml     # Production container orchestration
├── nginx.conf                  # Nginx API Gateway configuration (Development)
├── nginx.prod.conf             # Nginx API Gateway configuration (Production)
└── production-optimize.sh      # Production artisan caching and performance tuning script
```

---

## AI Agent Quick Task Map

When working on specific feature areas or bugfixes, reference this quick map to locate the relevant source code:

| Engineering Task | Primary Backend Files | Primary Frontend Files | Key Directives |
| :--- | :--- | :--- | :--- |
| **Authentication & Tokens** | [AuthController.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/customer-service/app/Http/Controllers/AuthController.php)<br/>[AuthenticateSubsystem.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/ticket-service/app/Http/Middleware/AuthenticateSubsystem.php)<br/>[DecryptRsaPayload.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/customer-service/app/Http/Middleware/DecryptRsaPayload.php) | [Loginpage.jsx](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/frontend/web/src/pages/Loginpage.jsx)<br/>[rsa.js](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/frontend/web/src/utils/rsa.js)<br/>[axiosInstance.js](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/frontend/web/src/api/axiosInstance.js) | Never transmit unencrypted passwords. Respect dual-token validation. |
| **Ticket Lifecycle & SLAs** | [TicketController.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/ticket-service/app/Http/Controllers/TicketController.php)<br/>[SLAService.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/ticket-service/app/Services/SLAService.php)<br/>[SLARuleController.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/ticket-service/app/Http/Controllers/SLARuleController.php) | [MyTickets.jsx](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/frontend/web/src/pages/MyTickets.jsx)<br/>[EmployeeMyTickets.jsx](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/frontend/web/src/pages/EmployeeMyTickets.jsx)<br/>[CSIncoming.jsx](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/frontend/web/src/pages/CSIncoming.jsx) | Invalidate Redis cache on updates via `SCAN`. Broadcast `TicketChanged`. |
| **File Uploads & Antivirus** | [AttachmentController.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/attachment-service/app/Http/Controllers/AttachmentController.php)<br/>[ClamAVScanner.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/attachment-service/app/Services/ClamAVScanner.php) | [FilePreviewModal.jsx](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/frontend/web/src/components/FilePreviewModal.jsx) | Stream to ClamAV (port 3310) before saving. Max size 15MB. |
| **Live Chat & Messaging** | [MessageController.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/messaging-service/app/Http/Controllers/MessageController.php)<br/>[Message.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/messaging-service/app/Models/Message.php) | [MessagingPage.jsx](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/frontend/web/src/pages/MessagingPage.jsx) | Store in MongoDB `messages`. Broadcast over Reverb (port 6002). |
| **Predictive Analytics** | [PredictiveAnalyticsController.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/analytics-service/app/Http/Controllers/PredictiveAnalyticsController.php)<br/>[FeedbackController.php](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/services/analytics-service/app/Http/Controllers/FeedbackController.php) | [PredictiveAnalytics.jsx](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/frontend/web/src/pages/PredictiveAnalytics.jsx)<br/>[AdminReports.jsx](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/frontend/web/src/pages/AdminReports.jsx) | Read from local analytics MySQL tables. Render via Chart.js. |
| **Gateway & Reverse Proxy** | [nginx.conf](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/nginx.conf)<br/>[nginx.prod.conf](file:///c:/Users/Shelley/Desktop/projects/php/enterprise-ticketing-system/nginx.prod.conf) | N/A | Maintain route parity between dev and prod configurations. |

