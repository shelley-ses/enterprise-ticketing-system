# Pull Request: [Title]

### Metadata
| Attribute | Details |
| :--- | :--- |
| **Tracking Issue / Ticket** | Ref # |
| **Target Base Branch** | `dev` (Staging) / `main` (Production Release) |
| **Change Classification** | Feature / Bug Fix / Refactor / Security / Infrastructure / Documentation |
| **Impact Level** | Low / Medium / High / Critical |

---

## 1. Executive Summary & Business Rationale
<!-- Provide a concise explanation of the change, the problem being addressed, and the business or operational value delivered. -->

---

## 2. Technical Architecture & Affected Subsystems
<!-- Identify all subsystems and architectural layers modified by this change. -->

### Affected Components
- [ ] `frontend/web` — React 19 / Tailwind v4 Single-Page Application
- [ ] `services/customer-service` — Customer Identity, Authentication, and Profiles (Port 8001)
- [ ] `services/ticket-service` — Core Ticket Lifecycle, State Machine, and SLA Engine (Port 8002)
- [ ] `services/notification-service` — Reverb WebSockets and Email Alerts (Port 8003)
- [ ] `services/analytics-service` — CSAT Ratings and Metric Reporting (Port 8004)
- [ ] `services/AI-service` — Google Gemini 2.0 Flash Automated Triage (Port 8005)
- [ ] `services/attachment-service` — Attachment Storage and ClamAV Antivirus Inspection (Port 8006)
- [ ] `services/messaging-service` — Real-Time Chat System / MongoDB 7 (Port 8007)
- [ ] `gateway` / `infrastructure` — Nginx Reverse Proxy, Docker Compose, CI/CD Workflows

### Architectural Invariants Verification
- [ ] **Decoupled Persistence**: No cross-service database queries or direct table access.
- [ ] **Thin Controllers**: Business logic encapsulated into service classes (`app/Services/`).
- [ ] **Documentation Compliance**: No Mermaid diagrams introduced; documentation uses structured tables/ASCII.
- [ ] **AI Fallback Invariant**: Google Gemini failures degrade directly to manual ticket escalation (no local LLM).

---

## 3. Security, Cryptography & Compliance
<!-- Verify adherence to enterprise security and compliance standards. -->
- [ ] **Client-Side RSA Encryption**: Sensitive credentials encrypted client-side via RSA prior to network transit.
- [ ] **Antivirus Inspection**: File upload endpoints enforce ClamAV daemon verification before persistence.
- [ ] **Subsystem Authentication**: Inter-service requests authenticated via JWT and shared public keys (`oauth-public.key`).
- [ ] **Non-Blocking Cache Invalidation**: Redis cache operations use `SCAN` chunking; zero blocking `KEYS *` calls.
- [ ] **Secret Hygiene**: Zero credentials, private keys, or `.env` files staged or committed.

---

## 4. Infrastructure, Database & Environment Impact
| Prerequisite | Status | Details |
| :--- | :--- | :--- |
| **Database Migrations** | None / Required | e.g. `services/<service>/database/migrations/...` |
| **Environment Variables** | None / Required | e.g. Key additions documented in `.env.example` |
| **Nginx Routing Rules** | None / Required | e.g. Gateway updates in `nginx.conf` / `nginx.prod.conf` |
| **Daemon / Worker Restarts**| None / Required | e.g. `reverb`, queue workers |

---

## 5. Testing & Verification Evidence
<!-- Provide automated test execution results and manual verification records. -->

### Automated Test Execution
```bash
# Commands executed to validate the changes
docker compose exec <service> php artisan test
```

### Manual Verification Matrix
| Test Case | Procedure | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| TC-01 | | | | Verified |
| TC-02 | | | | Verified |

---

## 6. Deployment & Rollback Strategy
* **Deployment Sequence**:
  1. Deploy updated service containers or code.
  2. Execute pending database migrations (`php artisan migrate --force`).
  3. Reload Nginx configuration if routing rules were modified.
* **Rollback Plan**:
  <!-- Outline step-by-step instructions to revert this change if unexpected anomalies occur. -->

---

## 7. Pre-Merge Verification Checklist
- [ ] Branch complies with repository naming conventions (`feat/*`, `fix/*`, `chore/*`, `docs/*`).
- [ ] Commit history follows Conventional Commits standard.
- [ ] Shared frontend changes tested across both Customer (`/`) and Employee (`/ticketing/`) contexts.
- [ ] Automated CI pipeline checks pass without errors.