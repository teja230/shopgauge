# Security Policy

## Reporting a Vulnerability

We take the security of StoreSight/ShopGauge seriously. If you believe you have found a security vulnerability, please report it responsibly.

**Do NOT** open a public GitHub issue for security vulnerabilities.

**Instead:**
1. Email: **security@shopgaugeai.com** (or use [GitHub Security Advisories](https://github.com/teja230/storesight/security/advisories/new))
2. Include: description, steps to reproduce, potential impact, and suggested fix (if any)

**Response timeline:**
- Acknowledgment within 48 hours
- Regular progress updates
- Critical vulnerabilities patched within 7 days
- Credit in release notes (if you wish)

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x   | Yes       |
| < 1.0   | No        |

---

## Security Audit Report

**Audit date:** February 16, 2026
**Scope:** Full codebase, git history, configuration, infrastructure, application vulnerabilities, frontend dependencies

### Summary

| Severity | Count | Status                              |
|----------|-------|-------------------------------------|
| Critical | 4     | Open — fix before public deployment |
| High     | 8     | Open — fix recommended              |
| Medium   | 9     | Open — hardening items              |
| Low      | 5     | Informational                       |
| **Total**| **26**|                                     |

### Secrets & Git History

| Item                                   | Status                        | Details                                                                                                                |
|----------------------------------------|-------------------------------|------------------------------------------------------------------------------------------------------------------------|
| `config/.env` (production credentials) | **Not in git**                | Contains real API keys, DB password, JWT secrets. Correctly excluded by `.gitignore`. Never committed.                 |
| `config/.env.local`                    | **Not in git**                | Same as above. Never committed.                                                                                        |
| `config/.env.example`                  | In git (safe)                 | Contains only placeholder values. No real secrets.                                                                     |
| `cookies.txt`                          | **In git (tracked)**          | Contains an expired admin JWT token (expired July 10, 2025). Committed in `733a76c6`. Should be removed from tracking. |
| `frontend/cookies.txt`                 | **In git (tracked)**          | Empty file. Should be removed from tracking.                                                                           |
| `config/.env.example.backup`           | In git history only           | Verified contents: placeholder values only. No real secrets. Safe.                                                     |
| `config/.env.prod`                     | Not in git history            | Despite earlier reports, this file was never committed.                                                                |
| Java source files                      | Safe                          | All use `${VAR:default}` pattern. No hardcoded production secrets.                                                     |
| `build.gradle` (Flyway)                | **Hardcoded dev credentials** | `user = 'storesight'`, `password = 'storesight'` — local dev only, not production credentials.                         |

**Conclusion:** No production secrets exist in git history. The only tracked sensitive file (`cookies.txt`) contains an expired JWT token. Safe to make public after removing `cookies.txt` from tracking and rotating the JWT secret as a precaution.

---

### Vulnerability Findings

#### CRITICAL-1: Open Redirect in OAuth Flow

- **File:** `backend/src/main/java/com/storesight/backend/controller/ShopifyAuthController.java`
- **Lines:** 245-254 (storage), 557-578 (redirect)
- **Status:** Open

**Description:** The OAuth login endpoint accepts a `return_url` parameter from the user, stores it in Redis, and redirects to it after successful Shopify authentication — with no validation.

**Exploit scenario:**
```
GET /api/auth/shopify/login?shop=victim.myshopify.com&return_url=https://attacker.com/phish
```
User completes legitimate Shopify OAuth, then gets redirected to the attacker's site.

**Affected code:**
```java
// Line 251 — stores unvalidated user input
redisTemplate.opsForValue().set("oauth:return_url:" + state, return_url, ...);

// Line 559 — redirects without validation
redirectUrl = java.net.URLDecoder.decode(returnUrl, "UTF-8");
response.sendRedirect(redirectUrl);
```

**Remediation:** Validate `return_url` against an allowlist before storing. Only allow the configured `frontendUrl` or relative paths starting with `/`.

---

#### CRITICAL-2: CSRF Protection Disabled

- **File:** `backend/src/main/java/com/storesight/backend/WebSecurityConfig.java`
- **Line:** 242
- **Status:** Open

**Description:** CSRF protection is globally disabled:
```java
http.csrf(csrf -> csrf.disable())
```
This allows cross-site request forgery on all state-changing endpoints. An attacker's page can make authenticated POST/PUT/DELETE requests on behalf of a logged-in user.

**Context:** This is common in API-only backends that use JWT Bearer tokens (not cookies) for authentication. However, the admin panel uses cookie-based auth (`admin_token` HttpOnly cookie), making admin endpoints vulnerable to CSRF.

**Remediation:** Enable CSRF for cookie-authenticated endpoints (admin panel), or migrate admin auth to Bearer-only tokens.

---

#### CRITICAL-3: Server-Side Request Forgery (SSRF) via Competitor Scraping

- **File:** `backend/src/main/java/com/storesight/backend/service/CompetitorScraperWorker.java`
- **Lines:** 452-472 (Jsoup), 390-416 (Selenium)
- **Status:** Open

**Description:** The competitor scraping system fetches user-controlled URLs server-side using both Jsoup and Selenium WebDriver with insufficient URL validation:

```java
// Jsoup — fetches arbitrary URLs
Document doc = Jsoup.connect(url).userAgent(userAgent).timeout(30000).get();

// Selenium — navigates to arbitrary URLs
driver.get(url);
```

An attacker who controls a "competitor URL" can:
- Probe internal services (e.g., `http://localhost:5432`, `http://169.254.169.254/latest/meta-data/`)
- Access cloud metadata endpoints to steal IAM credentials
- Port-scan internal infrastructure
- Exfiltrate data from internal services

**Remediation:**
1. Validate URLs against a strict allowlist of schemes (`https://` only)
2. Resolve DNS and reject private/internal IP ranges (`10.x`, `172.16-31.x`, `192.168.x`, `127.x`, `169.254.x`, link-local IPv6)
3. Use a dedicated egress proxy for all outbound scraping requests
4. Implement DNS rebinding protection (re-resolve after redirect)

---

#### CRITICAL-4: IDOR on Privacy Compliance Endpoints

- **File:** `backend/src/main/java/com/storesight/backend/controller/PrivacyComplianceController.java`
- **Lines:** 37-73
- **Status:** Open

**Description:** Privacy compliance endpoints accept a `shopId` parameter without verifying the requester owns that shop:

```java
@PostMapping("/export")
public ResponseEntity<?> exportData(@RequestParam Long shopId) { ... }

@PostMapping("/delete")
public ResponseEntity<?> deleteData(@RequestParam Long shopId) { ... }

@PostMapping("/anonymize")
public ResponseEntity<?> anonymizeData(@RequestParam Long shopId) { ... }
```

Any authenticated user can export, delete, or anonymize another shop's data by supplying their `shopId`.

**Remediation:** Verify the authenticated user/session owns the target `shopId` before executing. Extract shop context from the authenticated session, not from request parameters.

---

#### HIGH-1: Content Security Policy Allows `unsafe-inline` and `unsafe-eval`

- **File:** `backend/src/main/java/com/storesight/backend/WebSecurityConfig.java`
- **Lines:** 254-255
- **Status:** Open

**Description:**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' ...
```
`unsafe-inline` allows any inline `<script>` tag to execute. `unsafe-eval` allows `eval()`. Together, they completely negate CSP's XSS protection.

**Remediation:** Remove `unsafe-inline` and `unsafe-eval`. Use nonce-based CSP for trusted inline scripts if needed.

---

#### HIGH-2: Rate Limiting Bypassable via X-Forwarded-For Spoofing

- **File:** `backend/src/main/java/com/storesight/backend/WebSecurityConfig.java`
- **Lines:** 416-428
- **Status:** Open

**Description:** The `getClientIpAddress()` method trusts the `X-Forwarded-For` header unconditionally:
```java
String xForwardedFor = request.getHeader("X-Forwarded-For");
if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
    return xForwardedFor.split(",")[0].trim();
}
```
An attacker can send a different `X-Forwarded-For` value with each request to bypass rate limiting entirely, enabling brute-force attacks on admin login.

**Remediation:** Only trust `X-Forwarded-For` when `request.getRemoteAddr()` matches a known proxy IP (e.g., Render's load balancer IPs).

---

#### HIGH-3: CORS Allows Wildcard Headers with Credentials

- **File:** `backend/src/main/java/com/storesight/backend/WebSecurityConfig.java`
- **Lines:** 359, 370
- **Status:** Open

**Description:**
```java
configuration.setAllowedHeaders(Arrays.asList("*"));
configuration.setAllowCredentials(true);
```
Wildcard headers combined with `allowCredentials` is an anti-pattern. While origins are restricted to a whitelist, this allows any custom header from whitelisted origins.

**Remediation:** Replace wildcard with explicit headers: `Content-Type`, `Authorization`, `X-Requested-With`.

---

#### HIGH-4: OAuth State Parameter Not Validated on Callback

- **File:** `backend/src/main/java/com/storesight/backend/controller/ShopifyAuthController.java`
- **Lines:** 242, 290, 543
- **Status:** Open

**Description:** The OAuth state parameter is generated and stored, but the callback does not verify that the received state matches a server-generated value. Combined with CRITICAL-1, this weakens the entire OAuth flow against CSRF attacks.

**Remediation:** Store the generated state in Redis with the expected shop domain. On callback, verify the state exists and matches.

---

#### HIGH-5: HMAC Validation Optional in OAuth Callback

- **File:** `backend/src/main/java/com/storesight/backend/controller/ShopifyAuthController.java`
- **Lines:** 349-374
- **Status:** Open

**Description:** The Shopify OAuth callback HMAC validation is optional — it only runs when both `hmac` and `apiSecret` are non-null, and failures are caught and silently ignored:

```java
if (hmac != null && apiSecret != null) {
    try {
        // validate HMAC
    } catch (Exception e) {
        // logs warning but continues processing
    }
}
```

An attacker can forge OAuth callbacks without valid HMAC signatures. This enables OAuth flow manipulation where the attacker substitutes their own authorization code.

**Remediation:** Make HMAC validation mandatory. Return 403 immediately if HMAC is missing or invalid.

---

#### HIGH-6: Shop Domain IDOR via Query Parameter Fallback

- **File:** `backend/src/main/java/com/storesight/backend/config/ShopifyAuthenticationFilter.java`
- **Lines:** 117-126
- **Status:** Open

**Description:** The authentication filter falls back to extracting the shop domain from the query parameter when the cookie is missing:

```java
// Falls back to query parameter
String shopDomain = request.getParameter("shop");
```

Authentication is then set based solely on whether the shop exists in the database — not whether the requester owns it. An attacker who knows a victim's shop domain can access their data by including `?shop=victim.myshopify.com` in API requests.

**Remediation:** Validate shop ownership against the authenticated session. Never accept shop identity from query parameters for authenticated operations.

---

#### HIGH-7: Demo Mode Toggle Endpoint Unauthenticated

- **File:** `backend/src/main/java/com/storesight/backend/controller/DemoModeController.java`
- **Lines:** 190-213
- **Status:** Open

**Description:** The demo mode toggle endpoint is at `/api/demo/admin/toggle`, which falls under the `/api/demo/**` path that is `permitAll` in `WebSecurityConfig.java:267`. Despite having "admin" in its path, it requires no authentication.

Any unauthenticated user can toggle demo mode on/off for the entire application, potentially disrupting service or hiding real data behind demo data.

**Remediation:** Move the toggle endpoint to `/api/admin/demo/toggle` so it falls under the `AdminAuthenticationFilter` protection. Alternatively, add explicit authentication checks within the controller method.

---

#### HIGH-8: IDOR on SSE Event Subscriptions

- **File:** `backend/src/main/java/com/storesight/backend/controller/SseController.java`
- **Lines:** 61-173
- **Status:** Open

**Description:** SSE (Server-Sent Events) subscriptions accept a `{shopDomain}` path parameter without verifying the subscriber has access to that shop's events:

```java
@GetMapping("/subscribe/{shopDomain}")
public SseEmitter subscribe(@PathVariable String shopDomain) { ... }
```

An attacker can subscribe to real-time events for any shop, receiving live updates about competitor analysis results, product changes, and business intelligence data.

**Remediation:** Validate shop ownership from the authenticated session before allowing subscription.

---

#### MEDIUM-1: Health and Actuator Endpoints Expose Operational Details

- **Files:**
  - `WebSecurityConfig.java:271` — `/api/health/**` permitted without auth
  - `application-prod.properties:47` — Actuator exposes `health,info,metrics,prometheus`
- **Status:** Open

**Exposed data:** Database connection pool stats (active/idle/max connections), Redis memory and connection info, CPU/memory/disk usage percentages, session counts, cache hit rates.

**Risk:** Attackers learn exact resource constraints (512MB memory, 20 max DB connections, 15 Tomcat threads) enabling targeted resource exhaustion.

**Remediation:** Restrict `/api/health/**` detailed endpoints behind authentication. Limit Actuator to `health` only in production.

---

#### MEDIUM-2: Default Development Credentials

- **File:** `backend/src/main/resources/application-dev.properties`
- **Lines:** 43-46
- **Status:** Open

**Description:**
```properties
admin.username=${ADMIN_USERNAME:admin}
admin.password=${ADMIN_PASSWORD:admin123}
admin.jwt.secret=${ADMIN_JWT_SECRET:dev-jwt-secret-key-for-development-only-change-in-production}
```
If the dev profile is accidentally activated in production, these weak defaults become the live credentials.

**Remediation:** Remove password defaults. Fail fast if environment variables are not set.

---

#### MEDIUM-3: Information Disclosure in OAuth Error Messages

- **File:** `backend/src/main/java/com/storesight/backend/controller/ShopifyAuthController.java`
- **Lines:** 586-603
- **Status:** Open

**Description:** Error handling differentiates between "API key" errors and "access_token" errors, revealing implementation details to the client. This aids reconnaissance.

**Remediation:** Return a generic "Authentication failed" message to the client. Log detailed errors server-side only.

---

#### MEDIUM-4: Flyway Hardcoded Credentials in build.gradle

- **File:** `backend/build.gradle`
- **Lines:** 115-117
- **Status:** Open

**Description:**
```gradle
flyway {
    url = 'jdbc:postgresql://localhost:5432/storesight'
    user = 'storesight'
    password = 'storesight'
}
```
These are local development credentials, not production. However, they should use environment variables for consistency.

**Remediation:** Use `System.getenv('DB_PASS')` with no fallback default.

---

#### MEDIUM-5: Form-Action CSP Too Permissive

- **File:** `backend/src/main/java/com/storesight/backend/WebSecurityConfig.java`
- **Line:** 262
- **Status:** Open

**Description:** The `form-action` directive allows form submissions to many Shopify subdomains. This broadens the attack surface for form-based clickjacking.

**Remediation:** Restrict `form-action` to `'self'` and only the specific Shopify domains required for OAuth.

---

#### MEDIUM-6: JWT Token Returned in Response Body

- **File:** `backend/src/main/java/com/storesight/backend/controller/AdminAuthController.java`
- **Lines:** 73-76
- **Status:** Open

**Description:** The admin login endpoint returns the JWT token in both the response body (JSON) and as an HttpOnly cookie. While the cookie is correctly configured (HttpOnly, Secure, SameSite), the response body exposure means any XSS vulnerability can steal the token directly from the login response or from JavaScript code that processes it.

**Remediation:** Return the JWT only in the HttpOnly cookie. Remove it from the response body. Frontend should rely on the cookie being sent automatically.

---

#### MEDIUM-7: Shop Cookie Not HttpOnly

- **File:** `backend/src/main/java/com/storesight/backend/controller/ShopifyAuthController.java`
- **Lines:** 499-501
- **Status:** Open

**Description:** The shop domain cookie is set without the HttpOnly flag:
```java
shopCookie.setHttpOnly(false);
```
This makes the shop cookie readable by JavaScript, allowing XSS attacks to extract the shop domain and use it for IDOR attacks (see HIGH-6).

**Remediation:** Set `setHttpOnly(true)` on the shop cookie. If JavaScript needs the shop domain, provide it through a dedicated API endpoint.

---

#### MEDIUM-8: Private IP Detection Bypassable

- **File:** `backend/src/main/java/com/storesight/backend/service/InputValidationService.java`
- **Lines:** 273-280
- **Status:** Open

**Description:** The private IP detection regex used for SSRF prevention can be bypassed using:
- Subdomain tricks: `10.0.0.1.attacker.com`
- IPv6 representations: `::ffff:127.0.0.1`, `[::1]`
- Octal encoding: `0177.0.0.1` (resolves to `127.0.0.1`)
- Decimal encoding: `2130706433` (resolves to `127.0.0.1`)
- URL authority tricks: `http://attacker.com@127.0.0.1`

**Remediation:** Use `InetAddress.getByName()` to resolve DNS first, then check the resolved IP against private ranges using `InetAddress.isSiteLocalAddress()`, `isLoopbackAddress()`, and `isLinkLocalAddress()`.

---

#### MEDIUM-9: Frontend Dependencies with Known CVEs

- **File:** `frontend/package.json`
- **Status:** Open

| Package | Version | Issue |
|---------|---------|-------|
| `jspdf` | 3.0.1 | Multiple critical CVEs — upgrade to 4.1.0+ |
| `axios` | 1.10.0 | DoS vulnerabilities in request processing |
| `react-router-dom` | 6.22.3 | XSS via open redirects in route handling |

**Remediation:** Run `npm audit fix` and update to latest stable versions. For jsPDF specifically, upgrade to 4.x which addresses the critical vulnerabilities.

---

#### LOW-1: Debug Console Logging in Frontend

- **Files:** Multiple frontend files (`IntelligentDemoManager.ts`, `HomePage.tsx`, others)
- **Status:** Open

**Description:** `console.log` statements in production code expose application logic, feature flags, and demo strategies in browser DevTools.

**Remediation:** Gate debug logging behind `import.meta.env.DEV` checks or strip in production builds.

---

#### LOW-2: Weak Regex-Based Input Validation

- **File:** `backend/src/main/java/com/storesight/backend/WebSecurityConfig.java`
- **Lines:** 157-213
- **Status:** Open (not exploitable)

**Description:** SQL injection and XSS detection uses simple regex patterns that are easily bypassed (`sel/**/ect`, URL encoding, etc.). However, the actual database layer uses Spring Data JPA with parameterized queries throughout, so SQL injection is not possible regardless.

**Impact:** None in practice — the ORM provides the real protection. The regex creates false positives (blocks legitimate searches containing words like "select" or "delete").

---

#### LOW-3: Wildcard CORS Origin Patterns

- **File:** `backend/src/main/java/com/storesight/backend/config/WebCorsConfig.java`
- **Lines:** 37-39
- **Status:** Open

**Description:** `https://*.shopify.com` and `https://*.myshopify.com` allow any Shopify subdomain. While Shopify-controlled, it's broader than necessary.

**Remediation:** Use specific subdomains: `admin.shopify.com`, `accounts.shopify.com`.

---

#### LOW-4: `cookies.txt` Tracked in Git (Expired Token)

- **File:** `cookies.txt` (root)
- **Commit:** `733a76c6`
- **Status:** Open

**Description:** Contains an admin JWT token that expired on July 10, 2025 (7+ months ago). Not usable for authentication. The token signature could theoretically be used to verify a JWT secret offline, but only if the secret is weak.

**Remediation:**
```bash
git rm --cached cookies.txt frontend/cookies.txt
git commit -m "chore: remove tracked cookies.txt files"
```
Rotate JWT secret as a precaution.

---

#### LOW-5: Authentication State in localStorage

- **File:** `frontend/src/context/AuthContext.tsx`
- **Lines:** 125-126, 141-142
- **Status:** Open

**Description:** Demo mode can be triggered via `?demo=true` URL parameter, which sets auth state in localStorage. While the real admin auth uses HttpOnly cookies (not stealable via XSS), the localStorage-based demo state could be manipulated by XSS to force users into or out of demo mode.

**Remediation:** Use session-scoped state for demo mode instead of localStorage. Validate demo mode server-side.

---

### Non-Issues (Verified Safe)

| Claim                                        | Verification                                                                                                                                                                                                                                          |
|----------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| "Admin endpoints have no authentication"     | **False.** `AdminAuthenticationFilter` intercepts all `/api/admin/**` requests (except `/api/admin/login`) and requires a valid, non-blacklisted JWT token. Verified at `AdminAuthenticationFilter.java:56-98`. Auth is enforced at the filter level. |
| "SQL injection possible"                     | **False.** The entire codebase uses Spring Data JPA with parameterized queries. No raw SQL string concatenation found anywhere.                                                                                                                       |
| "Production secrets in git history"          | **False.** `config/.env` and `config/.env.local` were never committed. `config/.env.example.backup` in history contains only placeholders. Verified by examining actual git blob contents.                                                            |
| "Database directly accessible from internet" | **Misleading.** The `0.0.0.0/0` in `render.yaml` is Render's default IP allowlist. Access still requires valid credentials. Render manages the network layer. Should be tightened but is not an open database.                                        |
| "Command injection"                          | **Not present.** No `Runtime.exec()` or `ProcessBuilder` with user input found.                                                                                                                                                                       |
| "Path traversal"                             | **Not present.** No file operations using user-supplied paths found.                                                                                                                                                                                  |
| "Insecure deserialization"                   | **Not present.** No `ObjectInputStream` or unsafe deserialization found.                                                                                                                                                                              |

---

### Information Exposed by Public Repository

Making the source code public reveals operational details that aid targeted attacks. These are not vulnerabilities but reduce the attacker's effort:

| Category             | What's Exposed                                                | Where                                                      |
|----------------------|---------------------------------------------------------------|------------------------------------------------------------|
| Resource limits      | 512MB memory, 15 Tomcat threads, 20 DB connections            | `application-prod.properties`                              |
| Rate limiting config | 60 req/min, 5 login attempts / 15 min lockout                 | `application.properties`, `AdminAuthenticationFilter.java` |
| Infrastructure       | Render service names, regions, free plan, 2 backend instances | `render.yaml`                                              |
| Database schema      | All 47 migration files with full table/column definitions     | `db/migration/V*.sql`                                      |
| Feature flags        | All flags and their defaults                                  | `application.properties:470-559`                           |
| Production domains   | `api.shopgaugeai.com`, `www.shopgaugeai.com`                  | `render.yaml`, `application.properties`                    |
| Shopify OAuth config | Redirect URI, scopes, API version                             | `render.yaml`, `application.properties`                    |
| Demo token           | `demo_access_token_shopgauge_2024`                            | `DemoModeService.java:30`                                  |
| Cache/session TTLs   | 15 min default cache, 4 hour sessions, 2 hour cleanup         | `application.properties`                                   |
| Alert thresholds     | Memory 80%/95%, CPU 80%/95%, connection pool 80%/95%          | `application.properties`                                   |

---

## Action Plan

### Before Making Repository Public

The following items are organized by priority. Complete all **P0** items before making the repo public. **P1** items should be completed promptly after. **P2** items are hardening improvements.

#### P0 — Must Fix Before Going Public

These items prevent active exploitation if the source code is visible.

- [ ] **Remove `cookies.txt` from git tracking**
  ```bash
  git rm --cached cookies.txt frontend/cookies.txt
  git commit -m "chore: remove tracked cookies.txt files"
  ```

- [ ] **Rotate JWT secret** — Even though the token in `cookies.txt` is expired, rotate the JWT signing secret so offline brute-force against the old token signature is useless:
  ```bash
  openssl rand -hex 64
  ```
  Update the `ADMIN_JWT_SECRET` env var in Render.

- [ ] **Fix Open Redirect (CRITICAL-1)** — Validate `return_url` in `ShopifyAuthController.java` against an allowlist (frontendUrl or relative paths starting with `/`). Reject absolute URLs to external domains.

- [ ] **Fix SSRF (CRITICAL-3)** — In `CompetitorScraperWorker.java`:
  1. Restrict to `https://` scheme only
  2. Resolve DNS and reject private IP ranges before connecting
  3. Implement redirect-following safety (re-check resolved IP after redirects)

- [ ] **Fix Privacy IDOR (CRITICAL-4)** — In `PrivacyComplianceController.java`, extract `shopId` from the authenticated session instead of accepting it as a request parameter.

- [ ] **Make HMAC validation mandatory (HIGH-5)** — In `ShopifyAuthController.java`, reject OAuth callbacks where HMAC is missing or invalid instead of silently continuing.

- [ ] **Fix Shop Domain IDOR (HIGH-6)** — In `ShopifyAuthenticationFilter.java`, remove the query parameter fallback for shop domain. Always derive it from the authenticated session/cookie.

- [ ] **Fix Demo Toggle Auth (HIGH-7)** — Move `/api/demo/admin/toggle` to `/api/admin/demo/toggle` so `AdminAuthenticationFilter` protects it.

- [ ] **Fix SSE IDOR (HIGH-8)** — In `SseController.java`, validate the authenticated user owns the shop before allowing SSE subscription.

- [ ] **Delete redundant security docs** (to avoid confusion with stale information):
  ```bash
  git rm SECURITY_AUDIT_REPORT.md SECURITY_ACTION_PLAN.md
  git rm backend/docs/SECURITY_AUDIT_REPORT.md backend/docs/SECURITY_COMPLIANCE_VALIDATION.md
  git commit -m "chore: consolidate security docs into SECURITY.md"
  ```

#### P1 — Fix Promptly After Public Release

- [ ] **Enable CSRF for admin endpoints (CRITICAL-2)** — Enable CSRF protection selectively for cookie-authenticated admin endpoints in `WebSecurityConfig.java`, or migrate admin auth to Bearer-only.

- [ ] **Fix rate limiting (HIGH-2)** — Only trust `X-Forwarded-For` when `request.getRemoteAddr()` matches Render's load balancer IPs.

- [ ] **Tighten CSP (HIGH-1)** — Remove `'unsafe-inline'` and `'unsafe-eval'` from `script-src`. Use nonce-based CSP.

- [ ] **Validate OAuth state (HIGH-4)** — Store state in Redis with expected shop domain. Verify on callback.

- [ ] **Restrict CORS headers (HIGH-3)** — Replace wildcard headers with `Content-Type`, `Authorization`, `X-Requested-With`.

- [ ] **Set shop cookie HttpOnly (MEDIUM-7)** — Change `setHttpOnly(false)` to `setHttpOnly(true)` in `ShopifyAuthController.java`.

- [ ] **Remove JWT from response body (MEDIUM-6)** — In `AdminAuthController.java`, return only the HttpOnly cookie. Remove token from the JSON response.

- [ ] **Fix private IP detection (MEDIUM-8)** — Use `InetAddress` resolution + `isSiteLocalAddress()`/`isLoopbackAddress()` instead of regex.

- [ ] **Update frontend dependencies (MEDIUM-9)** — Run `npm audit fix` and specifically upgrade `jspdf` to 4.x.

#### P2 — Hardening (Post-Release)

- [ ] **Restrict Actuator endpoints (MEDIUM-1)** — Limit to `health` only in production; require auth for metrics/prometheus.
- [ ] **Remove default dev credentials (MEDIUM-2)** — Fail fast if env vars not set instead of falling back to `admin`/`admin123`.
- [ ] **Generic OAuth error messages (MEDIUM-3)** — Return "Authentication failed" instead of specific error types.
- [ ] **Externalize Flyway credentials (MEDIUM-4)** — Use `System.getenv()` in `build.gradle`.
- [ ] **Tighten form-action CSP (MEDIUM-5)** — Restrict to `'self'` and specific Shopify OAuth domains.
- [ ] **Strip console.log in production (LOW-1)** — Add Vite plugin or gate behind `import.meta.env.DEV`.
- [ ] **Tighten CORS origins (LOW-3)** — Use specific Shopify subdomains instead of wildcards.
- [ ] **Session-scope demo mode (LOW-5)** — Remove localStorage usage for auth state; use session-scoped state.

### After Making Repository Public

- [ ] **Rotate ALL production credentials immediately** (even though none are in git, this is defense in depth):

| Credential             | Where to Rotate                           | Where to Update          |
|------------------------|-------------------------------------------|--------------------------|
| Shopify API Key/Secret | Shopify Partner Dashboard                 | Render env vars          |
| ScrapingDog Key        | scrapingdog.com/dashboard                 | Render env vars          |
| Serper Key             | serper.dev/api-key                        | Render env vars          |
| SerpAPI Key            | serpapi.com/manage-api-key                | Render env vars          |
| JWT Secret             | Generate with `openssl rand -hex 64`      | Render env vars          |
| Session Encryption Key | Generate with `openssl rand -base64 32`   | Render env vars          |
| Admin Password         | Generate new BCrypt hash                  | Render env vars          |
| Database Password      | Render dashboard                          | Auto-updated by Render   |

- [ ] **Enable GitHub security features**:
  - Dependabot alerts and security updates
  - Secret scanning
  - CodeQL analysis (Java + JavaScript)
  - Branch protection rules on `main`

- [ ] **Monitor for issues**:
  - Watch for unusual API traffic patterns
  - Monitor Shopify app analytics for unauthorized installs
  - Set up alerts for failed authentication spikes

---

## Security Architecture

### Authentication & Authorization

- **Admin passwords**: BCrypt hashed (cost factor 12)
- **Admin sessions**: JWT (HS512) with 24-hour expiration, stored in HttpOnly secure cookies
- **Admin auth filter**: `AdminAuthenticationFilter` intercepts all `/api/admin/**` requests, validates JWT, checks token blacklist
- **Critical operations**: Additional authorization required for `/api/admin/secrets`, `/api/admin/emergency/*`
- **Shopify sessions**: OAuth 2.0 with access tokens stored in Redis and PostgreSQL
- **Session encryption**: AES-256-GCM with secure IV generation
- **Rate limiting**: Redis-backed, per-IP, with separate limits for login attempts, general admin requests, and sensitive operations
- **Account lockout**: 5 failed attempts triggers 15-minute lockout (configurable)
- **Audit logging**: All admin actions logged with username, IP, user agent, timestamp, and action details

### Data Protection

- Security headers: X-Frame-Options (DENY), X-Content-Type-Options, HSTS (1 year), CSP
- CORS restricted to configured production domains and Shopify subdomains
- Input validation: SQL injection and XSS pattern detection on query parameters
- Database: Spring Data JPA with parameterized queries (primary SQL injection defense)
- Data retention: 90 days configurable, GDPR-compliant handling with soft delete
- Production error responses: No stack traces, no exception details, no binding errors (`server.error.include-stacktrace=never`)

### Infrastructure

- Non-root Docker containers in production (appuser UID 1001)
- Multi-stage Docker builds (no build tools in production image)
- Environment variables for all secrets via `${VAR}` syntax
- Health checks configured for liveness and readiness probes
- JVM tuned for memory-constrained environments (G1GC, heap dump on OOM)

---

## Self-Hosting Security Checklist

- [ ] Generate strong, unique values for all secrets in `.env` (see `config/.env.example`)
- [ ] Use HTTPS for all communications
- [ ] Use different credentials for each environment (dev/staging/prod)
- [ ] Restrict database IP allowlist to application servers only
- [ ] Enable SSL/TLS for database and Redis connections
- [ ] Enable database backups and test restoration
- [ ] Review and restrict Actuator endpoint exposure in production
- [ ] Monitor application and audit logs for suspicious activity
- [ ] Set up alerts for failed authentication attempts
- [ ] Keep all dependencies up to date
- [ ] Enable GitHub Dependabot, secret scanning, and CodeQL on your fork

### Required Secrets

```bash
# JWT secret (64+ hex characters)
openssl rand -hex 64

# Session encryption key (32 bytes, Base64)
openssl rand -base64 32

# Admin password — set a strong password, the app hashes it with BCrypt
```

See `config/.env.example` for the complete list of environment variables.

---

## Third-Party Integrations

| Service     | Purpose                      | Key Required                              |
|-------------|------------------------------|-------------------------------------------|
| Shopify API | Store data, OAuth            | `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`   |
| ScrapingDog | Competitor search (primary)  | `SCRAPINGDOG_KEY`                         |
| Serper      | Competitor search (fallback) | `SERPER_KEY`                              |
| SerpAPI     | Competitor search (premium)  | `SERPAPI_KEY`                             |
| SendGrid    | Email notifications          | `SENDGRID_API_KEY`                        |
| Twilio      | SMS notifications            | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |

Best practices:
- Use separate API keys for development and production
- Monitor API usage dashboards for anomalies
- Rotate keys immediately if you suspect compromise

---

## Dependency Security

```bash
# Backend (Java/Gradle)
cd backend && ./gradlew dependencyCheckAnalyze

# Frontend (Node.js)
cd frontend && npm audit
```

---

## Incident Response

1. **Contain**: Rotate all compromised credentials immediately
2. **Investigate**: Review audit logs (`/api/admin/audit-logs`), determine scope and entry point
3. **Remediate**: Patch the vulnerability, implement additional controls, test fixes
4. **Communicate**: Notify affected users, publish a GitHub Security Advisory

---

*Last updated: February 16, 2026*
