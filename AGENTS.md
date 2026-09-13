# Enterprise Ticketing System - Agent Guidelines & Governance

Welcome to the **Enterprise Ticketing System** codebase. This file serves as the primary orientation and operating guide for AI coding assistants and developers.

## Repository Overview

This repository is an enterprise-grade, microservice-based IT service desk and ticketing platform:

* **Microservices (`services/`)**:
  * `services/AI-service`: Google Gemini 2.0 Flash automated support assistant, conversation persistence, ticket triage, and fallback ticket escalation.
  * `services/ticketing-service`: Core ticket lifecycle, SLA monitoring, status state machines, and priority management.
  * `services/auth-service`: JWT token issuance, RBAC, RSA credential decryption, and subsystem authentication.
  * `services/asset-service`: Hardware/software asset catalog, serial tracking, and ticket linkages.
  * `services/attachment-service`: Attachment storage with mandatory ClamAV antivirus daemon inspection.
  * `services/audit-service`: Immutable append-only audit trails for regulatory compliance.
  * `services/notification-service`: Real-time Reverb WebSocket broadcasting and transactional email alerts.
* **Frontend (`frontend/web/`)**: React 19 SPA with Vite, Tailwind CSS v4, Lucide icons, and dual-mode runtime (`employee` at `/ticketing/` vs `customer` at `/`).
* **Gateway (`nginx/`)**: Nginx reverse proxy routing `/api/*` to corresponding microservice FastCGI or HTTP sockets.
* **Documentation (`docs/`)**: Technical specs and architecture guides (maintained with zero Mermaid diagrams, relying on clear ASCII tables).

## Agent Customizations

AI assistants operating within this repository are configured with specialized rules and skills:

### Rules (`.agents/rules/`)
* [`.agents/rules/coding-standards.md`](.agents/rules/coding-standards.md): Cryptography standards (client-side RSA), ClamAV scanning, thin controllers, and non-blocking Redis cache invalidation.
* [`.agents/rules/70-commits-pull-requests.md`](.agents/rules/70-commits-pull-requests.md): Branch naming rules (`feat/*`, `fix/*`), Conventional Commits, and pull request generation standards.

### Skills (`.agents/skills/`)
* **`github-pr`**: Inspects status, branches from `dev`, enforces commit conventions, and opens reviewable PRs via GitHub CLI (`gh`).
* **`laravel-microservice`**: Scaffolds and modifies Laravel services adhering to migrations, models, thin controllers, Redis caching, and inter-service authentication.
* **`react-frontend`**: Implements UI features in `frontend/web/` honoring dual-mode context, Tailwind v4 design tokens, and client-side RSA encryption.
* **`docker-runbook`**: Executes container commands, database migrations, logs, and ClamAV/Reverb operational checks.
* **`gemini-ai`**: Manages the Google Gemini 2.0 Flash AI support subsystem, conversation persistence, escalation payloads, and direct manual ticket fallback.
* **`api-testing`**: Verifies endpoints across the Nginx gateway and microservices with JWT bearer tokens.

## Inviolable Architectural Invariants

1. **Strictly No Mermaid Diagrams**: All documentation must use markdown tables, ASCII diagrams, or structured text. Never generate Mermaid syntax.
2. **Strictly No Ollama**: AI fallback must degrade directly to manual ticket creation (`escalate: true`). Do not reintroduce local Ollama fallbacks.
3. **No Direct Database Coupling**: Microservices communicate exclusively through REST APIs or event broadcasts. Do not query another microservice's database tables directly.
4. **Client-Side RSA Encryption**: Passwords and sensitive credentials must be encrypted using `frontend/web/src/utils/rsa.js` before network transmission and decrypted with `DecryptRsaPayload` middleware.
5. **Mandatory Antivirus Scanning**: File uploads in `attachment-service` must pass ClamAV daemon verification before being saved to storage.
6. **Non-Blocking Cache Invalidation**: Always use Redis `SCAN` chunking for ticket cache invalidation; never issue blocking `KEYS *`.
7. **Branch Protection**: Never push directly to `dev` or `main`. Always create a typed work branch and open a PR targeting `dev`.
