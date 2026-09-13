---
name: react-frontend
description: Build and maintain UI components, pages, state management, and real-time features in the React 19 frontend (frontend/web/). Use when working on frontend pages, dual-mode views (customer vs employee), styling, or API integrations.
---

# React Frontend Development Guide

This skill governs the development of the Single Page Application in `frontend/web/`.

## 1. Dual-Mode Architecture

The frontend supports two distinct operating modes from a single unified React codebase:

* **Customer Mode** (Default route `/`, Port 5006):
  * Designed for end-users seeking assistance.
  * Minimalist, accessible interface: Self-service ticket submission, Gemini AI interactive diagnostics widget, and status tracking.
* **Employee / Agent Mode** (Route `/ticketing/`, Port 5005):
  * Designed for IT support technicians and system administrators.
  * Rich dashboard: Ticket queues, Kanban boards, SLA countdown bars, ticket assignment, internal audit comments, asset linkage, and escalation controls.

### Mode Detection & Routing:
Always verify the current user role and active context via `useAuth()` or `useMode()`:
```jsx
import { useAuth } from '@/context/AuthContext';

export function TicketView() {
  const { isEmployee, user } = useAuth();

  return (
    <div>
      {isEmployee ? <AgentWorkbench /> : <CustomerTicketPortal />}
    </div>
  );
}
```

---

## 2. Client-Side Cryptography (Mandatory RSA)

**CRITICAL SECURITY INVARIANT**: Never submit raw plaintext passwords or API credentials over HTTP.

Prior to calling `/api/auth/login` or password change endpoints, encrypt the payload with the server's public RSA key using `frontend/web/src/utils/rsa.js`:

```javascript
import { encryptPayload } from '@/utils/rsa';
import { apiConfig } from '@/config/api.config';

const handleSubmit = async (credentials) => {
  // Encrypt sensitive fields with the public RSA key
  const encryptedPayload = await encryptPayload({
    email: credentials.email,
    password: credentials.password,
    timestamp: Date.now(),
  });

  const response = await fetch(apiConfig.endpoints.auth.login, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: encryptedPayload }),
  });
};
```

---

## 3. UI Styling & Visual Aesthetics

* **Tailwind CSS v4**: Utilize Tailwind v4 utility classes and CSS variables.
* **Aesthetics Standards**:
  * Rich dark & light mode support with slate/zinc neutral tones.
  * Glassmorphism cards (`backdrop-blur-md bg-white/10 dark:bg-zinc-900/60 border border-white/20 dark:border-zinc-800`).
  * Subtle hover micro-animations (`transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`).
  * SLA urgency badges with dynamic color coding (Green: >50% SLA remaining, Amber: 20-50%, Red: <20% or breached).
* **Icons**: Exclusively use `lucide-react` for iconography (e.g. `Ticket`, `Cpu`, `AlertTriangle`, `Bot`, `ShieldCheck`).

---

## 4. Real-Time WebSockets (Laravel Echo)

Subscribed to real-time events via Laravel Echo connected to the Reverb server (port 6001):

```javascript
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;
const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: window.location.hostname,
  wsPort: 6001,
  forceTLS: false,
  enabledTransports: ['ws', 'wss'],
});

// Listening for ticket status updates
echo.private(`tickets.${ticketId}`)
  .listen('.TicketChanged', (e) => {
    updateTicketState(e.ticket);
  });
```

---

## 5. API Endpoints Configuration

Always reference endpoint paths from `frontend/web/src/config/api.config.js`:

```javascript
import { apiConfig } from '@/config/api.config';

// Examples:
// apiConfig.endpoints.ticketing.tickets
// apiConfig.endpoints.ticketing.ai.chat
// apiConfig.endpoints.auth.login
```
