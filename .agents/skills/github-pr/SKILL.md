---
name: github-pr
description: Formats, generates, and prepares GitHub Pull Requests following the repository's pull request template, coding invariants, and microservice guidelines.
---

# GitHub Pull Request Generator & Assistant

Use this skill when preparing or creating GitHub pull requests (`/github-pr`) for this repository.

## Instructions for Creating PRs

1. **Check Git Status & Modified Files**:
   Inspect the list of modified, added, or deleted files to identify the affected microservices and components:
   - `frontend/web` (React 19 / Tailwind v4)
   - `customer-service` (Port 8001 / Auth & Clients)
   - `ticket-service` (Port 8002 / Core Tickets & SLAs)
   - `employee-service` (Port 8008 / Employee Management)
   - `attachment-service` (Port 8006 / ClamAV Uploads)
   - `messaging-service` (Port 8007 / MongoDB & Reverb)
   - `analytics-service` (Port 8004 / CSAT & Reports)
   - `notification-service` (Port 8003 / Email & Push)
   - `AI-service` (Port 8005 / Gemini AI Support)
   - `docker-compose` / `nginx.conf` / Environment configs

2. **Template Compliance**:
   Structure the PR description to match `.github/pull_request_template.md`:
   - **Description**: Clear motivation, problem statement, and solution.
   - **Type of Change**: `[x]` Bug fix, `[x]` New feature, `[x]` Refactoring, etc.
   - **Microservices & Components Affected**: Check all relevant boxes.
   - **Database & Environment Changes**: Specify if migrations or `.env` changes are required.
   - **How Has This Been Tested?**: Step-by-step reproduction and verification steps.
   - **Pre-Merge Checklist**: Ensure code adheres to standards in `.agents/rules/coding-standards.md`.

3. **PR Formatting Example**:
   ```markdown
   ## Description
   Fixed AI conversation title prefixes and enabled discarded ticket visibility in ticket history.

   Closes #

   ---

   ## Type of Change
   - [x] 🐛 Bug fix (non-breaking change fixing an issue)
   - [ ] ✨ New feature (non-breaking change adding functionality)
   - [ ] 💥 Breaking change (fix or feature causing existing functionality to change)
   - [x] ♻️ Refactoring / Technical Debt (code reorganization with no behavioral change)
   - [ ] 📝 Documentation update (changes to `docs/` or README)
   - [ ] ⚙️ DevOps / Infrastructure (`docker-compose`, Nginx, CI/CD)

   ---

   ## Microservices & Components Affected
   - [x] `frontend/web` (React 19 / Tailwind v4)
   - [ ] `customer-service` (Port 8001 / Auth & Clients)
   - [x] `ticket-service` (Port 8002 / Core Tickets & SLAs)
   - [ ] `attachment-service` (Port 8006 / ClamAV Uploads)
   - [ ] `messaging-service` (Port 8007 / MongoDB & Reverb)
   - [ ] `analytics-service` (Port 8004 / CSAT & Reports)
   - [ ] `notification-service` (Port 8003 / Email & Push)
   - [x] `AI-service` (Port 8005 / Gemini AI Support)
   - [ ] `docker-compose` / `nginx.conf` / Environment configs
   ```
