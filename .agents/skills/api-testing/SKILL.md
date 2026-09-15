---
name: api-testing
description: Test and verify REST API endpoints across microservices and the Nginx API gateway. Use when verifying authentication, ticket lifecycle, file uploads, or Gemini AI endpoints.
---

# API Testing & Verification Guide

This skill provides step-by-step procedures and command templates for verifying REST endpoints across the Nginx API Gateway (`http://localhost/api`).

## 1. Authentication & JWT Token Acquisition

### Authenticate and Acquire Bearer Token:
```bash
# PowerShell
$body = @{
    email = "admin@example.com"
    password = "password"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $response.access_token
```

```bash
# cURL
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' | jq -r '.access_token')
```

---

## 2. Gemini AI Support Endpoints

### 1. Initiate AI Chat:
```bash
curl -s -X POST http://localhost/api/ticketing/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"My VPN client displays Error 800 when attempting to connect."}'
```

Expected Response:
```json
{
  "conversation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "reply": "Error 800 typically indicates a firewall or network route issue...",
  "escalate": false,
  "escalation_data": null
}
```

### 2. Retrieve Conversation History:
```bash
curl -s -X GET http://localhost/api/ticketing/ai/conversations \
  -H "Authorization: Bearer $token"
```

---

## 3. Ticketing Lifecycle Endpoints

### 1. Create a Ticket:
```bash
curl -s -X POST http://localhost/api/tickets \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cannot access billing portal",
    "description": "User receives 403 Forbidden after MFA approval",
    "category": "Software",
    "priority": "High"
  }'
```

### 2. Transition Ticket Status:
```bash
curl -s -X PUT http://localhost/api/tickets/1/status \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}'
```

---

## 4. Antivirus Upload Verification (ClamAV)

### 1. Upload Clean File:
```bash
curl -s -X POST http://localhost/api/attachments/upload \
  -H "Authorization: Bearer $token" \
  -F "file=@clean_document.pdf"
```
*Expected: HTTP 201 Created with file metadata and scan status `clean`.*

### 2. Upload Malware Test File (EICAR):
```bash
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar_test.txt
curl -s -i -X POST http://localhost/api/attachments/upload \
  -H "Authorization: Bearer $token" \
  -F "file=@eicar_test.txt"
rm eicar_test.txt
```
*Expected: HTTP 422 Unprocessable Entity, error message `Malware detected by ClamAV. Upload rejected.`*
