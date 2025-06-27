# ShopGauge Architecture & Security

This document provides an in-depth view of the ShopGauge backend architecture, multi-session design, and security/compliance posture.

---

## 1. High-Level Architecture

For a visual system overview see the diagram in **docs/README.md**.

### Component Breakdown

| Layer | Key Components | Technology |
|-------|----------------|------------|
| Frontend | React 18 + Vite, MUI, Tailwind, PWA | TypeScript |
| API Layer | API Gateway (`StoresightBackendApplication`) | Spring Boot 3 (WebFlux) |
| Services | Analytics, Discovery, Session, Notification, Privacy | Spring Beans |
| Data | PostgreSQL 15+, Redis 7 | Flyway, Spring Data JPA / RedisTemplate |
| External | Shopify API, Scrapingdog, Serper, SerpAPI, SendGrid, Twilio | REST / HTTPS |

---

## 2. Multi-Session Architecture

> **Problem**: Shopify allows only one access token per app install. Legacy single-session design overwrote tokens, causing data loss when merchants logged in from multiple devices.

### Database Schema (Simplified)

```sql
CREATE TABLE shop_sessions (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES shops(id),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    access_token VARCHAR(500) NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT now(),
    last_accessed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);
```

### Token Lookup Algorithm

1. **Redis (session key)** → `shop_token:{shop}:{sessionId}` – O(1) hit.
2. **PostgreSQL (session row)** – fallback if Redis miss.
3. **Redis (shop fallback)** → `shop_token:{shop}` – last active token.
4. **PostgreSQL (shop table)** – legacy fallback.

### Session APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/sessions/active` | List all active sessions for current shop |
| `GET /api/sessions/current` | Info about current session |
| `POST /api/sessions/terminate` | Terminate a given session |
| `POST /api/sessions/terminate-others` | Kill all other sessions |
| `GET /api/sessions/health` | Session health & diagnostics |

---

## 3. Security Posture

### Encryption

* **In Transit** – TLS 1.3 enforced on all HTTPS endpoints.
* **At Rest** – AES-256 encryption on database & Redis volumes (cloud provider).

### Secure Coding Practices

* **Input Validation** – Spring Validation & explicit object mapping.
* **SQL Injection** – JPA parameter binding only.
* **XSS / CSP** – React escapes plus CSP headers via Spring Security.

### Authentication & Authorization

* **Shopify OAuth 2.0** – HMAC validation, nonce state, access-token exchange.
* **Session Cookies** – `Secure`, `HttpOnly`, `SameSite=Lax`.
* **Role-based Access** – Spring Method Security annotations (ADMIN, SHOP_OWNER).

### Compliance

| Standard | Implementation |
|----------|----------------|
| GDPR / CCPA | Data minimisation, export, deletion endpoints (`/privacy/*`) |
| Shopify PCD L2 | Level 2 approved (orders & customer IDs only) |
| Audit Logging | PostgreSQL `audit_logs` – 365-day retention |

---

## 4. Performance & Cost Optimisations

* **Exponential Cache** – Multi-layer (Redis + in-memory) with TTL tuning.
* **Back-Pressure** – WebClient + Project Reactor supports non-blocking I/O.
* **Rate-Limit Awareness** – Automatic 429 handling with jittered retry.
* **Multi-Provider Discovery** – Cheapest provider first; fallback to premium only when necessary (avg 95 % cost saving).

---

## 5. Deployment Topology (Recommended)

| Component | Replica | Notes |
|-----------|---------|-------|
| API Pod | 2-4 | Horizontal Pod Auto-scaling (CPU + queue length) |
| Worker Pod | 1 | Background discovery & notifications |
| PostgreSQL | Managed (HA) | pgBouncer connection pool recommended |
| Redis | Managed (HA) | 1 GB cache tier + persistence |
| Object Storage | AWS S3 | Export / backup dumps |

---

## 6. Future Hardening

* mTLS between internal services (Gateway ↔ Workers).
* Field-level encryption for extra-sensitive columns.
* Webhook signature verification cache.
* GraphQL API gateway with persisted queries.

---

© 2025 ShopGauge – Secure, scalable analytics for Shopify. 