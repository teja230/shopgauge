# ShopGauge – Features Overview

Welcome to the **Features Overview**. This document provides a consolidated, high-level look at every major capability built into ShopGauge.

---

## 1. Analytics Engine

| Capability | Details |
|------------|---------|
| **Real-Time Revenue** | 60-day timeseries, 120-minute cache, 7 chart types (line, area, bar, candlestick, waterfall, stacked, composed). |
| **Conversion & Funnel** | End-to-end checkout funnel analytics, industry benchmarking. |
| **Inventory Intelligence** | Low-stock alerts, product velocity KPIs, demand forecasting. |
| **Abandoned Cart Recovery** | Automated detection, reporting & notification pipeline. |
| **Dashboard Widgets** | Metric cards, revenue chart, insight banners – fully responsive. |

> Backend endpoints: `/api/analytics/*`

---

## 2. AI-Powered Market Intelligence

| Component | Description |
|-----------|-------------|
| **Multi-Provider Discovery** | Integrates **Scrapingdog**, **Serper** & **SerpAPI** with automatic fallback and cost optimisation. |
| **Keyword Builder** | Generates Google Shopping queries from product catalog. |
| **Search Client Abstraction** | Strategy pattern – pluggable providers, exponential caching. |
| **Background Worker** | `CompetitorDiscoveryService` scheduled daily (configurable). |
| **Suggestion Lifecycle** | Status flow: NEW → APPROVED/REJECTED → MONITORED. |

> Backend path: `service/discovery/*`

---

## 3. Multi-Session Architecture

* Concurrent sessions per shop (isolation via `shop_sessions` table).
* Redis token cache (`shop_token:{domain}:{sessionId}`) with fallback chain.
* Session management API: `/api/sessions/active`, `/terminate`, `/health`.
* Session-scoped notifications for complete privacy.

See **Architecture & Security** doc for deep-dive.

---

## 4. Notification System

| Channel | Provider | Scope |
|---------|----------|-------|
| **Email** | SendGrid | Shop / Session |
| **SMS** | Twilio | Shop |
| **In-App** | React Hot Toast | Session |

Features:
* Real-time push with optimistic UI update.
* Notifications TTL & soft delete support.
* Scoping rules (`SHOP`, `SESSION`).

---

## 5. User Experience & Frontend

* **Intelligent Loading Screen** – analytics animations, single-display guarantee.
* **Responsive Navigation** – MUI drawer with notification badge.
* **404/Error UX** – Smart redirect, countdown, animated analytics.
* **PWA-Ready** – Vite build, manifests, offline placeholder planned.
* **Accessibility** – Keyboard navigation, ARIA labels, WCAG-AA colour contrast.

---

## 6. Security & Compliance (Highlights)

* AES-256 at rest, TLS 1.3 in transit.
* GDPR / CCPA compliant data handling.
* Shopify Protected Customer Data (Level 2) approval.
* Complete audit trail – 365-day retention.

Full details in **Architecture & Security** doc.

---

_This overview replaces multiple enhancement docs (Analytics, Market Intelligence, UI/UX, Notifications). For changelog-level history please refer to Git commit logs._ 