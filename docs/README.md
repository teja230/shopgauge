# ShopGauge Documentation Hub

Welcome to the **ShopGauge** documentation hub. This is the single starting point for all technical and product
information about the platform. If you're new to ShopGauge, start here.

> **Audience**: Shopify merchants, solution architects, DevOps / SRE engineers, and developers integrating with or
> contributing to ShopGauge.

---

## 📈 Platform Overview

**ShopGauge** is an enterprise-grade analytics & competitor-intelligence platform for Shopify. Key capabilities include:

| Category | Capabilities |
|----------|--------------|
| **Advanced Analytics** | Real-time revenue, conversion, inventory & customer behaviour dashboards (7+ chart types) |
| **AI-Powered Market Intelligence** | Multi-provider competitor discovery (Scrapingdog, Serper, SerpAPI) with fall-back & cost optimisation |
| **Multi-Session Architecture** | Concurrent log-ins, session isolation, token caching & intelligent clean-up |
| **Notification System** | Session-scoped notifications via Email (SendGrid) & SMS (Twilio) with in-app centre |
| **Security & Compliance** | GDPR / CCPA, Shopify Protected Data L2, AES-256 at rest, TLS 1.3 in transit, full audit trail |
| **Cost & Performance Optimisations** | Exponential caching, debounced refreshes, 95 %+ API cost reduction |
| **Enterprise UX** | Intelligent loading screen, responsive dashboard, mobile navigation & PWA-ready |

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Frontend (React 18 / TS)"
        UI[Dashboard & Admin <br/> Tailwind + MUI]
        Auth[Auth Context <br/> Shopify OAuth]
        Notifications[Session Notification Centre]
    end

    subgraph "API & Services (Spring Boot 3)"
        Gateway[API Gateway]
        AnalyticsSvc[Analytics Service]
        DiscoverySvc[Competitor Discovery]
        SessionSvc[Multi-Session Service]
        NotificationSvc[Notification Service]
        PrivacySvc[Data Privacy Service]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL 15+)]
        Redis[(Redis 7)]
    end

    subgraph "External"
        Shopify[Shopify API]
        Scrapingdog[Scrapingdog]
        Serper[Serper]
        SerpAPI[SerpAPI]
        SendGrid[SendGrid]
        Twilio[Twilio]
    end

    UI --> Gateway
    Gateway --> AnalyticsSvc
    Gateway --> DiscoverySvc
    Gateway --> SessionSvc
    Gateway --> NotificationSvc
    Gateway --> PrivacySvc

    SessionSvc --> PG
    SessionSvc --> Redis
    AnalyticsSvc --> PG
    AnalyticsSvc --> Redis
    DiscoverySvc --> Scrapingdog
    DiscoverySvc --> Serper
    DiscoverySvc --> SerpAPI
    AnalyticsSvc --> Shopify
    NotificationSvc --> SendGrid
    NotificationSvc --> Twilio
```

> For a deep-dive into the **multi-session design**, see **[Multi-Session Architecture](MULTI_SESSION_ARCHITECTURE.md)**.

---

## 📚 Feature-Level Documentation

| Area | Documentation |
|------|---------------|
| **Environment & Deployment** | 🔗 [Environment Setup](ENVIRONMENT_SETUP.md) |
| **Market Intelligence** | 🔗 [Market Intelligence](MARKET_INTELLIGENCE.md) |
| **AI Market Intelligence** | 🔗 [Competitor Discovery System](MULTI_SESSION_ARCHITECTURE.md#competitor-discovery) |
| **Notification Centre** | 🔗 [Notification System](NOTIFICATIONS_SYSTEM.md) |
| **Admin System** | 🔗 [Admin Comprehensive Guide](SHOPGAUGE_ADMIN_COMPREHENSIVE_GUIDE.md) |
| **Authentication & UI** | 🔗 [Authentication UI Fixes](AUTHENTICATION_UI_FIXES.md) |
| **Dashboard Performance** | 🔗 [Dashboard Loading Fixes](DASHBOARD_LOADING_FIXES.md) |
| **OAuth & Database** | 🔗 [OAuth Database Fixes](OAUTH_DATABASE_FIXES.md) |
| **Security & Compliance** | 🔗 [Privacy Policy](PRIVACY_POLICY.md) <br/> 🔗 [Shopify Protected Data Request](SHOPIFY_PROTECTED_DATA_REQUEST.md) |
| **Contribution Guide** | 🔗 [CONTRIBUTING](CONTRIBUTING.md) |
| **Architecture & Security** | 🔗 [Architecture & Security](ARCHITECTURE_SECURITY.md) |
| **Features Overview** | 🔗 [Features Overview](FEATURES_OVERVIEW.md) |
| **Setup & Operations** | 🔗 [Setup & Operations Guide](SETUP_OPERATIONS.md) |
| **Compliance & Privacy** | 🔗 [Compliance & Privacy](COMPLIANCE_PRIVACY.md) |

> Historical or one-off enhancement documents have been consolidated under the relevant feature areas above for easy
> discovery.

---

## 🚀 Quick Links

• **Production Demo** – <https://www.shopgaugeai.com>  
• **Public API Docs** – `/api/docs` (Swagger) once the backend is running  
• **GitHub Repository** – <https://github.com/teja230/shopgauge>

---

## 🆘 Support & Contact

| Purpose | Contact |
|---------|---------|
| General enquiries | support@shopgauge.com |
| Security | security@shopgauge.com |
| Privacy | privacy@shopgauge.com |
| Enterprise sales | sales@shopgauge.com |

---

© 2025 ShopGauge – Intelligent analytics & competitive insights for Shopify merchants. 