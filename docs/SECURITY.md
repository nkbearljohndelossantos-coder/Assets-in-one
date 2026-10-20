# Security & Compliance Specification
## Unified ITMS + PPE Enterprise System

---

## 1. Security Architecture & Threat Model

The Unified ITMS + PPE application is engineered following the principle of **Defense in Depth**. It secures corporate IT infrastructure telemetry and sensitive capital asset accounting against unauthorized access, data leakage, and financial tampering.

---

## 2. Authentication & Credential Management

1. **Password Hashing**:
   - All passwords are encrypted using `bcrypt` with a minimum cost factor of 10 (`$2a$10$`).
   - Passwords are never stored in plaintext and never logged in console outputs or audit logs.

2. **JSON Web Tokens (JWT)**:
   - Stateless JWT tokens sign user identities with HMAC SHA-256 (`HS256`).
   - Token payload includes: `id`, `username`, `email`, `roles`, and `permissions`.
   - Access token lifespan: 8 hours (`JWT_ACCESS_EXPIRY=8h`).
   - Refresh token lifespan: 7 days (`JWT_REFRESH_EXPIRY=7d`).
   - Dynamic token verification middleware extracts the bearer token from the `Authorization: Bearer <TOKEN>` HTTP header.

3. **Dual Login Identifier**:
   - The login endpoint accepts either `username` or corporate `email` interchangeably while maintaining uniform response timing to mitigate username enumeration attacks.

---

## 3. Role-Based Access Control (RBAC)

The system features 7 core roles and 77 fine-grained permissions:

| Normalized Role | Scope & Privileges | Typical Assigned Users |
| :--- | :--- | :--- |
| **SUPER_ADMIN** | Unrestricted global access; can manage roles, system configs, audit logs, and backups. | Lead System Architect, IT Director |
| **ADMIN** | Unrestricted operational access; can manage all IT assets, PPE assets, and accounting journals. | Senior IT Manager, Corporate Controller |
| **STAFF** | Operational access; can manage IT repairs, tickets, inventory, and PPE assets. | IT Support Specialist, Property Custodian |
| **ACCOUNTANT** | Full access to PPE depreciation, Chart of Accounts, Journal Vouchers, and reports. | Senior Accountant, Financial Auditor |
| **USER** | Read-only access to assigned personal assets; can create and view personal helpdesk tickets. | General Employees |

### Granular Authorization Middleware
Route handlers enforce least-privilege access using declarative middleware:
```javascript
// Require specific capability
router.post('/assets', authenticateToken, requirePermission('ppe.assets.create'), ...);

// Require high-level administrative role
router.post('/accounts', authenticateToken, requireRole('ADMIN', 'Super Admin'), ...);
```

---

## 4. Application Defense Mechanisms

### 4.1. SQL Injection Prevention
All database queries are executed through **Knex.js parameterized query bindings** (`?` placeholders). Raw string interpolation in SQL statements is strictly prohibited.

### 4.2. Input Validation & Type Safety
Incoming request payloads are rigorously validated using **Zod schema validators** before reaching database layers. Requests with malformed fields, out-of-range dates, or negative monetary amounts are rejected with HTTP 400.

### 4.3. HTTP Security Headers (Helmet)
Express endpoints are fortified using the `helmet` security suite:
- `Content-Security-Policy`: Restricts resource injection and cross-site scripting (XSS).
- `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing exploits.
- `X-Frame-Options: SAMEORIGIN`: Prevents clickjacking attacks.
- `Strict-Transport-Security` (HSTS): Enforces HTTPS connections in production.

### 4.4. Cross-Origin Resource Sharing (CORS)
CORS is locked to explicit allowlisted origins via the `CORS_ALLOWED_ORIGINS` environment variable. Unrecognized origins cannot read API responses or send authenticated cross-site requests.

### 4.5. Rate Limiting & DoS Protection
The API platform enforces token bucket rate limiting (1000 requests per 15-minute window for standard endpoints; 10 requests per minute for the `/api/auth/login` endpoint) to stop brute-force password guessing.

### 4.6. Secure File Uploads
Asset photo uploads handled by `multer` enforce:
- Whitelist of allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
- Maximum upload size: 10 MB per file.
- Uploads stored in dedicated `/uploads` directory with script execution disabled.

---

## 5. Audit Logging & Compliance

Every state-changing operation (Create, Update, Delete, Post, Void) invokes `logAudit()`:
- Records `user_id`, `username`, `action`, `module`, `record_id`, client `ip_address`, and browser `user_agent`.
- Captures serializable JSON diffs of `old_values` and `new_values`.
- Audit logs are append-only; standard API routes provide no endpoints to modify or delete audit entries.
