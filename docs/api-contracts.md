# API & Event Contracts

This document specifies the REST API endpoints, Nginx gateway path routing, HTTP request/response schemas, and real-time WebSocket channel contracts across the **Enterprise Ticketing System**.

---

## Gateway Routing Conventions

All external API calls must target the Nginx reverse proxy gateway. Nginx rewrites the public path to internal microservice endpoints:

```
Public Path:      /api/ticketing/{subsystem}/{endpoint}
Internal Target:  http://{subsystem}-service:9000/api/{endpoint}
```

---

## 1. `customer-service` Endpoints

Base Gateway URL: `/api/ticketing/customer`

### Public Authentication Endpoints

#### `GET /encryption-key`
* **Description**: Returns the active RSA public key for client-side encryption.
* **Response `200 OK`**:
  ```json
  {
    "public_key": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...",
    "key_id": "key_2026_09"
  }
  ```

#### `POST /login`
* **Middleware**: `throttle:ip_auth`, `decrypt.rsa:password`
* **Request Body**:
  ```json
  {
    "email_or_username": "technician@company.com",
    "password": "ENCRYPTED_RSA_STRING",
    "user_type": "employee" // or "customer"
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "token_type": "Bearer",
    "access_token": "eyJ0eXAiOiJKV1QiLCJh...",
    "expires_in": 86400,
    "user": {
      "id": 14,
      "name": "Jane Doe",
      "email": "technician@company.com",
      "role": "employee",
      "department_id": 2
    }
  }
  ```

#### `POST /auth/refresh`
* **Description**: Exchanges a valid refresh token for a new access token.

#### `POST /forgot-password` & `POST /reset-password`
* **Description**: OTP-based self-service credential recovery.

---

### Authenticated Endpoints (`auth.subsystem`)

| Method | Endpoint | Description | Roles Allowed |
| :--- | :--- | :--- | :--- |
| `GET` | `/me` | Retrieve authenticated user profile | All authenticated |
| `PUT` | `/profile` | Update contact details and avatar | All authenticated |
| `POST` | `/change-password` | Rotate credentials with RSA payload | All authenticated |
| `GET` | `/employee-statuses` | Real-time presence of engineers | CS, Admin |
| `POST` | `/customers/provision` | Automated customer registration | Admin, Internal |

---

## 2. `ticket-service` Endpoints

Base Gateway URL: `/api/ticketing/ticket`

### Ingestion & Dashboard Endpoints

#### `POST /tickets`
* **Description**: Creates a new customer support ticket.
* **Request Body**:
  ```json
  {
    "title": "Hydraulic Press Sensor Failure",
    "description": "Pressure gauge fluctuating erratically under load.",
    "department_id": 1,
    "machine_category_id": 3,
    "problem_category_id": 7,
    "ticket_priority_id": 1,
    "attachment_ids": ["uuid-1", "uuid-2"]
  }
  ```
* **Response `201 Created`**:
  ```json
  {
    "status": "success",
    "ticket": {
      "id": 1042,
      "ticket_number": "TICK-2026-1042",
      "status_id": 1,
      "created_at": "2026-09-13T01:30:00Z"
    }
  }
  ```

#### `GET /customer-dashboard`
* **Description**: Customer dashboard metrics (active tickets, pending proof, resolved).

#### `GET /cs-dashboard` & `GET /cs-incoming`
* **Description**: Support queue management with unassigned and urgent tickets.

---

### Ticket Operations (`auth.subsystem`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/tickets/{id}` | Complete ticket details with work logs and audit history |
| `POST` | `/tickets/{id}/assign` | Assigns an employee to the ticket |
| `PATCH` | `/tickets/{id}/accept` | Technician accepts ticket (moves to `InProgress`) |
| `POST` | `/tickets/{id}/employee-update` | Technician logs work or submits proof of completion |
| `PATCH` | `/tickets/{id}` | Updates ticket status (e.g., Approve / Reject Proof) |
| `POST` | `/tickets/{id}/reassign-request` | Technician requests reassignment with justification |
| `POST` | `/tickets/{id}/reassign-respond` | CS lead approves or rejects reassignment |
| `GET` | `/employee/worklogs` | List of work log hours submitted by technician |
| `GET` | `/employee/worklogs/export` | Generates exportable summary of labor logs |

---

### SuperAdmin Management Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/superadmin/config` | Master lists of equipment, priorities, and statuses |
| `POST/PUT/DELETE` | `/superadmin/equipment/{id?}` | CRUD operations for machine types |
| `POST/PUT/DELETE` | `/superadmin/priority/{id?}` | CRUD operations for priority classifications |
| `GET/POST/PUT` | `/superadmin/sla-rules/{id?}` | Configure department and category SLA deadlines |
| `GET/POST/PUT` | `/superadmin/workflow-statuses`| Configure custom ticket lifecycle states |
| `GET/POST/PUT` | `/superadmin/escalation-rules` | Configure automated escalation triggers |
| `GET` | `/superadmin/audit-logs` | Immutable audit trail query with filters |

---

## 3. `attachment-service` Endpoints

Base Gateway URL: `/api/ticketing/attachment`

#### `POST /upload`
* **Request**: `multipart/form-data` with `attachments[]` and optional `is_proof="true"`.
* **Behavior**: Streams files to ClamAV socket (`3310`) and stores clean files.
* **Response `200 OK`**:
  ```json
  {
    "attachments": [
      {
        "id": "c1f75f92-5d9c-4b52-b8ec-f23696803ba9",
        "file_name": "diagnostic_log.txt",
        "file_size": 204850,
        "url": "/storage/attachments/c1f75f92_diagnostic_log.txt"
      }
    ]
  }
  ```

---

## 4. `messaging-service` Endpoints

Base Gateway URL: `/api/ticketing/messaging`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/tickets/{ticket_id}/messages` | Paginated chat transcript from MongoDB |
| `POST` | `/tickets/{ticket_id}/messages` | Post a new message; triggers Reverb broadcast |
| `PUT` | `/tickets/{ticket_id}/messages/{id}` | Edit message (stores revision in `edit_history`) |
| `DELETE`| `/tickets/{ticket_id}/messages/{id}` | Soft-deletes message for conversation participants |

---

## 5. Real-Time WebSocket Channel Catalog

### Core Reverb Server (Port 6001 / Gateway path: `/app/`)

| Channel | Type | Event | Description |
| :--- | :--- | :--- | :--- |
| `tickets` | Public | `TicketChanged` | Emitted on status change, assignment, or closure |
| `private-employee.{id}` | Private | `TicketAssigned` | Notifies assigned technician of new ticket |
| `private-customer.{id}` | Private | `TicketUpdated` | Notifies customer of technician progress or proof |

### Messaging Reverb Server (Port 6002 / Gateway path: `/messaging-app/`)

| Channel | Type | Event | Description |
| :--- | :--- | :--- | :--- |
| `presence-ticket-chat.{ticket_id}` | Presence | `MessageSent` | Real-time chat message delivery |
| `presence-ticket-chat.{ticket_id}` | Presence | `MessageUpdated` | Broadcasts message edits to participants |
| `presence-ticket-chat.{ticket_id}` | Presence | `MessageDeleted` | Removes message from participant UI |
| `presence-ticket-chat.{ticket_id}` | Presence | `UserTyping` | Ephemeral typing indicator |
