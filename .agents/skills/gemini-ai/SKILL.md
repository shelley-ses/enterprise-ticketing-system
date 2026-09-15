---
name: gemini-ai
description: Work with the Google Gemini 2.0 Flash AI support subsystem in services/AI-service. Use when modifying AI chat logic, prompt engineering, conversation persistence, automated escalation payloads, or manual ticket fallback.
---

# Google Gemini AI Support Subsystem Guide

This skill governs development and prompt design for the AI customer support subsystem in `services/AI-service`.

## 1. System Invariants & Model Selection

* **Model**: Google Gemini 2.0 Flash (`gemini-2.0-flash`).
* **REST API Endpoint**:
  ```text
  https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}
  ```
* **Strict Fallback Invariant (No Ollama)**:
  Under NO circumstances should local Ollama or other secondary LLMs be used as a fallback. If the Gemini API request fails (rate limit, missing API key, network timeout), the service must degrade **directly to manual ticket creation** with `escalate: true`.

---

## 2. Conversation Persistence Schema

All chat interactions are persisted in MySQL using the `ai_conversations` table:

```sql
CREATE TABLE ai_conversations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    conversation_uuid VARCHAR(36) UNIQUE NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    status ENUM('active', 'resolved', 'escalated') DEFAULT 'active',
    messages JSON NOT NULL,
    escalation_data JSON NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);
```

### JSON Message Format:
```json
[
  {"role": "user", "content": "My laptop won't connect to the corporate Wi-Fi."},
  {"role": "model", "content": "I can help with that. Are you using a Windows or macOS laptop, and is your network adapter toggled on?"}
]
```

---

## 3. Escalation Contract & Parsing

The system prompt instructs Gemini to emit an escalation directive when an issue requires human IT intervention (hardware repairs, account lockout, credential resets, or repeated failures):

```text
[ESCALATE: {
  "suggested_title": "Wi-Fi Adapter Hardware Failure",
  "suggested_category": "Network",
  "suggested_priority": "High",
  "system_summary": "User performed network reset and driver reload; Wi-Fi card does not appear in device manager.",
  "user_intent": "Hardware replacement or physical technician dispatch"
}]
```

`GeminiService::parseEscalation()` extracts this block, strips it from the user-facing text, and populates the `escalation_data` payload.

---

## 4. API Endpoints Reference

All endpoints are proxied through Nginx at `/api/ticketing/ai/`:

### 1. Send Message
* **POST** `/api/ticketing/ai/chat`
* **Request**:
  ```json
  {
    "message": "My monitor keeps flickering black.",
    "conversation_id": "optional-uuid-to-continue"
  }
  ```
* **Response**:
  ```json
  {
    "conversation_id": "e4b31a89-...",
    "reply": "Let's check the display cable...",
    "escalate": false,
    "escalation_data": null
  }
  ```

### 2. Manual Fallback Response (On Error)
```json
{
  "conversation_id": "e4b31a89-...",
  "reply": "Our AI assistant is temporarily unavailable. Would you like to create a support ticket directly with our human agents?",
  "escalate": true,
  "escalation_data": {
    "suggested_title": "Support Request",
    "suggested_category": "General",
    "suggested_priority": "Medium",
    "system_summary": "AI service offline fallback",
    "user_intent": "User requested support"
  }
}
```

### 3. Escalate to Ticket
* **POST** `/api/ticketing/ai/tickets`
* Creates a human ticket in `ticketing-service` with linked conversation history and audit trail.
