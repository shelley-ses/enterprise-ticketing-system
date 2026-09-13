## Description
<!-- Provide a brief description of the changes introduced by this PR. Include motivation, context, and problem statement. -->

Closes # <!-- Link issue number if applicable (e.g. Closes #42) -->

---

## Type of Change
<!-- Check the boxes that apply using an 'x' (e.g. [x]) -->
- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 💥 Breaking change (fix or feature causing existing functionality to change)
- [ ] ♻️ Refactoring / Technical Debt (code reorganization with no behavioral change)
- [ ] 📝 Documentation update (changes to `docs/` or README)
- [ ] ⚙️ DevOps / Infrastructure (`docker-compose`, Nginx, CI/CD)

---

## Microservices & Components Affected
<!-- Select all subsystems modified by this PR -->
- [ ] `frontend/web` (React 19 / Tailwind v4)
- [ ] `customer-service` (Port 8001 / Auth & Clients)
- [ ] `ticket-service` (Port 8002 / Core Tickets & SLAs)
- [ ] `attachment-service` (Port 8006 / ClamAV Uploads)
- [ ] `messaging-service` (Port 8007 / MongoDB & Reverb)
- [ ] `analytics-service` (Port 8004 / CSAT & Reports)
- [ ] `notification-service` (Port 8003 / Email & Push)
- [ ] `AI-service` (Port 8005 / Gemini AI Support)
- [ ] `docker-compose` / `nginx.conf` / Environment configs

---

## Database & Environment Changes
<!-- Please specify if migrations or new environment variables are needed -->
- [ ] **Database Migration required?**
  - [ ] Yes (specify service: `services/<service>/database/migrations`)
  - [ ] No
- [ ] **New Environment Variables (`.env`) required?**
  - [ ] Yes (specify variable names and update `.env.example`)
  - [ ] No

---

## How Has This Been Tested?
<!-- Describe the manual or automated test steps you performed to verify these changes -->
1. **Setup Steps**:
   ```bash
   # e.g., docker compose up -d --build
   ```
2. **Action Performed**:
   * *Step 1: Navigate to ...*
   * *Step 2: Click on ...*
3. **Observed Result**:
   * *The ticket status changed to ...*

---

## Pre-Merge Checklist
<!-- Review against project standards before requesting review -->
- [ ] My code follows the repository's [AI & Coding Guidelines](docs/ai-guidelines.md).
- [ ] Sensitive credentials/passwords are RSA-encrypted before transit (`encryptPayload`).
- [ ] File uploads continue to be validated through ClamAV antivirus scanning.
- [ ] Changes to shared frontend components do not break either **Employee** (`/ticketing/`) or **Customer** (`/`) portals.
- [ ] Any new API routes have corresponding entries in `nginx.conf` and `nginx.prod.conf`.
- [ ] Documentation updated in `docs/` if architectural changes were made.

---