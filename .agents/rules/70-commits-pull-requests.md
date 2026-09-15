---
description: Branching, commit conventions, safety checks, and pull request rules for git operations
globs: **/*
---

# Commit and Pull Request Governance

This rule defines the mandatory branching, commit structure, and pull request workflow for the Enterprise Ticketing System repository.

## 1. Branch Strategy & Protection Rules

* **Protected Branches**:
  * `main`: Production releases. Direct push is strictly prohibited.
  * `dev` (Staging/Integration): Active development base branch. Direct push is blocked by GitHub repository rulesets (`GH013`). All changes must land via a Pull Request.
* **Allowed Work Branches**:
  * `feat/<slug>`: New feature work (targets `dev`).
  * `fix/<slug>`: Bug fixes (targets `dev`, or `main` if hotfix).
  * `chore/<slug>`: Tooling, dependency, or config updates.
  * `docs/<slug>`: Documentation-only changes.
  * `refactor/<slug>`: Code refactoring with no behavioral alterations.
  * `test/<slug>`: Test suites and mocking.
  * `ci/<slug>`: GitHub Actions and workflow updates.
* **Never commit directly to `dev` or `main`**. If uncommitted work is on `dev` or `main`, immediately create a branch:
  ```bash
  git checkout -b feat/<slug>
  ```

## 2. Commit Message Standards

Follow the Conventional Commits specification:
```text
<type>(<scope>): <imperative summary>
```

### Allowed Types
* `feat`: A new user-facing or subsystem feature.
* `fix`: A bug fix.
* `docs`: Documentation updates only.
* `refactor`: Code restructuring without bug fixes or feature additions.
* `perf`: Performance improvements.
* `test`: Adding or correcting tests.
* `chore`: Build process, tooling, or dependency updates.
* `ci`: CI/CD configuration and GitHub Actions workflows.

### Microservice Scopes
* `ai-service`: Google Gemini integration, chat persistence, triage.
* `ticketing-service`: Tickets, SLA timers, status changes, assignments.
* `auth-service`: JWT, authentication, RSA decryption, role permissions.
* `attachment-service`: S3 storage, ClamAV antivirus daemon scans.
* `audit-service`: Immutable audit logs and tracking.
* `notification-service`: Reverb WebSockets, email alerts.
* `asset-service`: Hardware/software inventory and equipment tracking.
* `frontend`: React, Vite, Tailwind v4, client-side encryption.
* `gateway`: Nginx reverse proxy configuration.
* `docker`: Docker Compose and container setup.
* `rules`: AI agents, prompt definitions, workflow skills.

### Commit Hygiene
* Always wrap commit messages in single quotes `'...'` or write to a file to prevent PowerShell from expanding `$` variables or backticks.
* Never stage `.env` or sensitive credentials.
* Stage only files relevant to the change (`git add <file>...`).

## 3. Pull Request Standards

* **Base Branch**: Target `dev` for standard changes; target `main` only for production releases or hotfixes.
* **PR Template**: All pull requests must follow the structure in `.github/pull_request_template.md`.
* **Safe Body Creation**: Always generate PRs using `--body-file` to prevent PowerShell text truncation or backtick mangling:
  ```bash
  gh pr create --base dev --head <head-branch> --title '<type>(<scope>): <summary>' --body-file <temp-body-file>
  ```
* **Required Status Checks**: Microservice test matrix (`.github/workflows/laravel.yml`) must pass before merging.
