# Security Architecture & Cryptography

Security in the **Enterprise Ticketing System** is engineered using defense-in-depth principles, combining client-side payload encryption, distributed asymmetric token verification, real-time antivirus quarantine pipelines, and aggressive rate limiting.

---

## Security Architecture Overview

```
[Client Browser]
  |  1. Fetch RSA Public Key (/encryption-key)
  |  2. Encrypt passwords via JSEncrypt (RSA 2048-bit)
  v
[Nginx Security Perimeter]
  |  - Rate Limiting (throttle:ip_auth, throttle:otp_request)
  |  - Body Size Restriction (Max 30MB)
  |  - Strict CORS & Security Headers
  v
[customer-service (Identity Provider)]
  |  - Decrypt RSA payload via server private key (decrypt.rsa middleware)
  |  - Verify credentials with Bcrypt
  |  - Issue OAuth2 JWT token via Laravel Passport
  v
[Decoupled Microservices Verification]
  |  - Validate token signature against shared storage/oauth-public.key
  |  - auth.subsystem middleware executes central VerifyEmployeeJwt
  |  - Verify token revocation against Redis blacklist
```

---

## 1. Hybrid Cryptographic Authentication Flow

To eliminate credential sniffing and man-in-the-middle (MITM) cleartext exposure, the system implements **client-side RSA encryption** before passwords ever leave the user's browser.

### Client-Side Execution (`frontend/web/src/utils/rsa.js`)
```javascript
import JSEncrypt from 'jsencrypt';
import axiosInstance from '@/api/axiosInstance';

export async function fetchEncryptionKey() {
  const response = await axiosInstance.get('/encryption-key');
  return response.data; // { public_key: "-----BEGIN PUBLIC KEY...", key_id: "..." }
}

export function encryptPayload(payload, publicKey) {
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(publicKey);
  const encrypted = encryptor.encrypt(payload);
  if (!encrypted) throw new Error('Encryption failed');
  return encrypted;
}
```

### Backend Decryption Middleware (`decrypt.rsa`)
Registered in `Kernel.php` as `\App\Http\Middleware\DecryptRsaPayload::class`:
* Applied to routes: `/login`, `/reset-password`, `/change-password`.
* Automatically extracts encrypted payload parameters (e.g., `decrypt.rsa:password`).
* Decrypts using the server's private key using `openssl_private_decrypt` with `OPENSSL_PKCS1_PADDING`.
* Replaces the encrypted parameter in the `Request` instance with plaintext prior to validation.

---

## 2. Distributed Token Verification (`auth.subsystem`)

In a microservices architecture, services must validate caller identities without creating a synchronous bottleneck to `customer-service`.

### Two-Tier Identity Verification
1. **Central Employee JWT Verification**:
   * Evaluated first by `AuthenticateSubsystem` via `VerifyEmployeeJwt`.
   * Verifies the cryptographic signature against the shared asymmetric public key (`storage/oauth-public.key`).
   * Validates that the token ID (`jti`) is not flagged in the Redis distributed revocation blacklist.
   * Hydrates the request context with an `Employee` principal.
2. **Customer Passport Token Verification**:
   * If not an employee token, falls back to the standard Laravel Passport guard (`auth:api`).
   * Validates access token validity against the local Passport tables.
   * Hydrates the request context with a `Client` / `User` principal.

---

## 3. ClamAV Antivirus Quarantine Pipeline

All file attachments (ticket evidence, equipment photos, proof of completion) are scanned prior to storage persistence.

```
[Client]                               [attachment-service]               [Local Temp Disk]         [ClamAV Daemon (3310)]
   |                                            |                                 |                          |
(1)|-- POST /upload (attachments[]) ----------->|                                 |                          |
   |                                            |-- Sanitize filename regex       |                          |
(2)|                                            |-- Save temporary file --------->|                          |
   |                                            |   (/temp-scans/{uuid}_{name})   |                          |
(3)|                                            |-- Open TCP socket & stream chunks ------------------------>|
   |                                            |<-- Response: "stream: OK" or "FOUND" ----------------------|
   |                                            |                                 |                          |
   |                                            |-- CASE A: Scan Clean (OK):      |                          |
   |                                            |   - Move to storage/app/public  |                          |
(4)|<-- 200 OK with Attachment ID & URL --------|   - Link to ticket_attachments  |                          |
   |                                            |                                 |                          |
   |                                            |-- CASE B: Virus Detected:       |                          |
   |                                            |   - Unlink & delete temp file ->|                          |
(5)|<-- 422 Unprocessable Entity ---------------|   - Log security quarantine     |                          |
   |    ("File failed security scan")           |                                 |                          |
```

### Attachment Security Policies:
* **Maximum File Size**: 15 MB (`15360 KB`) per attachment.
* **Filename Sanitization**: Replaces all non-alphanumeric characters with underscores.
* **UUID Isolation**: Stored files are prefixed with cryptographic UUIDs to prevent directory traversal and direct URL predictability.

---

## 4. Rate Limiting & Throttling Policies

The application configures Redis-backed rate limiters in `RouteServiceProvider`:

| Throttle Key | Rate Limit | Scope / Target | Purpose |
| :--- | :--- | :--- | :--- |
| `throttle:ip_auth` | **5 requests / minute** | Client IP Address | Protects `/login`, `/auth/refresh`, `/forgot-password` against brute-force attacks |
| `throttle:otp_request` | **3 requests / 5 minutes** | User ID / Target Email | Prevents OTP spamming and SMS/Email exhaustion |
| Global API Throttle | **60 requests / minute** | Per authenticated user | Protects backend services against denial-of-service (DoS) |

---

## 5. Audit Logging

Every state-changing event produces an immutable audit record in `ticket_audit_logs`:
* **Attributes Recorded**: `ticket_id`, `user_id`, `user_type` (`employee` vs `client`), `action` (e.g., `STATUS_UPDATED`, `ASSIGNED`, `REASSIGNED`, `PROOF_REJECTED`), `old_values` (JSON), `new_values` (JSON), `ip_address`, and `user_agent`.
* **Tamper Protection**: Audit logs have non-cascading foreign keys (`ticket_id` is nullable on ticket purge) ensuring historical logs persist even if a parent ticket is archived.
