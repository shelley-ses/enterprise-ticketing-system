# Implementation Plan & System Roadmap

This document outlines the current maturity of the **Enterprise Ticketing System**, details the phased architectural roadmap for pending subsystems, and provides a standardized implementation template for developers and AI assistants.

---

## Current Subsystem Maturity Matrix

| Microservice / Component | Status | Implementation Progress | Next Major Milestone |
| :--- | :--- | :--- | :--- |
| **`customer-service`** | **Production Ready** | 95% | Multi-factor authentication (TOTP/SMS) |
| **`ticket-service`** | **Production Ready** | 90% | Controller refactoring & domain action decoupling |
| **`attachment-service`** | **Production Ready** | 95% | S3 / MinIO object storage driver |
| **`messaging-service`** | **Production Ready** | 90% | Group chat & typing presence indicators |
| **`analytics-service`** | **Production Ready** | 85% | Automated daily snapshot cron jobs |
| **`frontend/web`** | **Production Ready** | 90% | Dark mode theme toggle & i18n localization |
| **`AI-service`** | **Scaffolded** | 20% | Dual Gemini/OpenAI API + Ollama local engine |
| **`notification-service`** | **Scaffolded** | 20% | Dedicated Redis queue consumers for multi-channel alerts |

---

## Phased Execution Roadmap

### Phase 1: AI Service Completion (`AI-service`)
**Objective**: Transform `AI-service` from a boilerplate scaffold into an autonomous triage and intelligence engine.

```
[Triggers]                               [AI-service Router]                   [Target Capabilities]
- New Ticket Ingestion   -----\
- Customer Chat Message  ------> [Provider Dispatcher] ------------> - Auto-Categorization & Priority
                                   |                                  - Customer Sentiment Scoring
                                   +--> Cloud #1: Gemini 2.0 Flash    - Smart Knowledge Base Matcher
                                   +--> Cloud #2: OpenAI GPT-4o-mini
                                   +--> Fallback: Local Ollama (Llama 3)
```

#### Key Implementation Steps:
1. **Model Provider Abstraction**:
   * Create `App\Services\Contracts\LLMProviderInterface`.
   * Implement `GeminiProvider` (Google Gemini REST API), `OpenAIProvider`, and `OllamaProvider`.
   * Implement fallback circuit-breaker logic: if cloud API quotas are exhausted or network is offline, fallback automatically to local Ollama container.
2. **Automated Triage Endpoint (`POST /api/tickets/triage`)**:
   * Analyzes ticket title and description to predict:
     * `suggested_department_id`
     * `suggested_priority_id`
     * `sentiment_score` (-1.0 to +1.0)
     * `key_issue_summary`
3. **Smart Knowledge Base Assistant**:
   * Vector embedding or keyword-similarity search against past resolved tickets and knowledge articles to suggest immediate solutions to customers before technician dispatch.

---

### Phase 2: Decoupled Notification Dispatcher (`notification-service`)
**Objective**: Offload all email, SMS, and push notification workloads from `ticket-service` into an asynchronous worker service.

#### Key Implementation Steps:
1. **Event Ingestion Pipeline**:
   * Configure `notification-service` to listen to Redis event queues (`ticket.events`, `sla.warnings`).
2. **Multi-Channel Dispatch Engine**:
   * **Email**: HTML transactional templates (Markdown/Blade) via SMTP or SendGrid.
   * **SMS**: Critical SLA breach alerts for on-call engineers via Twilio / Vonage.
   * **Web Push**: Browser push notifications for technicians in the field.
3. **Notification Preferences**:
   * User-level notification settings (opt-in/opt-out per channel and severity level).

---

### Phase 3: Monolith Decomposition & Controller Refactoring
**Objective**: Decompose `TicketController.php` (currently over 3,800 lines) into focused, single-responsibility domain services.

#### Decomposition Target:
* `App\Services\TicketCreationService`: Ingestion, validation, initial SLA assignment.
* `App\Services\TicketAssignmentService`: Dispatching, reassignment, technician acceptance.
* `App\Services\TicketResolutionService`: Proof of completion submission, approval, rejection, and closure.
* `App\Services\SuperAdminConfigService`: Equipment, priority, and master data management.

---

## Standard Feature Implementation Template

Developers and AI pair programmers must follow this systematic checklist when proposing and developing new features:

```markdown
### Feature Implementation Checklist

#### 1. Architecture & Impact Analysis
- [ ] Identify affected microservices.
- [ ] Determine if changes require cross-service communication (REST, Redis, or WebSocket).
- [ ] Verify if Nginx routing rules in `nginx.conf` and `nginx.prod.conf` require updating.

#### 2. Database & Data Models
- [ ] Create timestamped Laravel migration file (`YYYY_MM_DD_HHMMSS_action.php`).
- [ ] Define foreign key constraints with appropriate deletion cascading rules.
- [ ] Update Eloquent models with `$fillable`, `$casts`, and relationship methods.

#### 3. Security & Validation
- [ ] Implement explicit form request validation (`App\Http\Requests\*`).
- [ ] Ensure sensitive fields (passwords, tokens) utilize RSA encryption and are hidden from JSON output (`$hidden`).
- [ ] Apply appropriate rate limiting and middleware (`auth.subsystem`, `throttle:*`).

#### 4. Service Layer & Controllers
- [ ] Keep controllers thin; place complex business rules in `App\Services\*`.
- [ ] Clear related Redis cache keys on update using the non-blocking pattern.
- [ ] Broadcast real-time events via Reverb where applicable.

#### 5. Frontend Integration
- [ ] Update Axios API client methods in `frontend/web/src/api/`.
- [ ] Integrate React state management with error toast notifications.
- [ ] Subscribe to Echo/Reverb channels for real-time reactivity.

#### 6. Verification & Automated Tests
- [ ] Run PHPUnit feature tests: `php artisan test`.
- [ ] Verify container builds: `docker compose build {service}`.
- [ ] Test cross-browser responsiveness and accessibility.
```
