# ShopGauge – Compliance & Privacy

ShopGauge is committed to protecting merchant and customer data while delivering actionable insights.

---

## 1. Regulatory Landscape

| Framework | Coverage |
|-----------|----------|
| **GDPR** | EU personal data protection |
| **CCPA/CPRA** | California consumer privacy |
| **Shopify Protected Customer Data** | Level-2 approval (orders & customer IDs) |

---

## 2. Data Minimisation

* Only processes: order totals, dates, financial & fulfilment status, anonymised customer IDs, product meta.
* No storage of names, emails, addresses or payment details.
* Aggregated analytics kept 90 days, raw order JSON purged after 60 days.

---

## 3. Customer Rights APIs

| Right | Endpoint |
|-------|----------|
| **Access / Export** | `GET /api/analytics/privacy/data-export` |
| **Deletion** | `POST /api/analytics/privacy/data-deletion` |
| **Opt-out** | `POST /api/analytics/privacy/opt-out` (planned) |

All requests logged to `audit_logs` with 365-day retention.

---

## 4. Security Controls

* **Encryption in Transit** – TLS 1.3.
* **Encryption at Rest** – AES-256 on DB & cache volumes.
* **Session Security** – HttpOnly / Secure / SameSite=Lax cookies, per-session tokens.
* **Access Control** – RBAC + principle of least privilege.
* **Audit Trail** – Full CRUD capture; tamper-evident.

---

## 5. Shopify Protected Data – Technical Measures

* Data minimiser in `DataPrivacyService` strips PII before persistence.
* Redis TTL enforces 60-day expiry for raw order cache.
* Purpose validation guard ensures only approved analytics purposes.

See **`docs/SHOPIFY_PROTECTED_DATA_REQUEST.md`** for formal request/approval details.

---

## 6. Contact

| Role | Email |
|------|-------|
| Data Protection Officer | dpo@shopgauge.com |
| Security | security@shopgauge.com |
| Privacy Enquiries | privacy@shopgauge.com |

We answer privacy enquiries within **48 hours** and fulfil deletion requests within **30 days**.

---

© 2025 ShopGauge – Privacy by design, security by default. 