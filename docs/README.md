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
| **Setup & Compliance** | 🔗 [Setup & Compliance](SETUP_AND_COMPLIANCE.md) |
| **Market Intelligence** | 🔗 [Market Intelligence](MARKET_INTELLIGENCE.md) |
| **Analytics & Dashboard** | 🔗 [Analytics & Dashboard](ANALYTICS_AND_DASHBOARD.md) |
| **Session & Shop Management** | 🔗 [Session & Shop Management](SESSION_AND_SHOP_MANAGEMENT.md) |
| **Admin & Security** | 🔗 [Admin & Security](ADMIN_AND_SECURITY.md) |
| **Notification System** | 🔗 [Notification System](NOTIFICATIONS_SYSTEM.md) |
| **Mobile Enhancements** | 🔗 [Mobile Enhancements](MOBILE_ENHANCEMENTS.md) |
| **Features Overview** | 🔗 [Features Overview](FEATURES_OVERVIEW.md) |
| **Contribution Guide** | 🔗 [CONTRIBUTING](CONTRIBUTING.md) |

> All documentation has been consolidated into logical groups for easier discovery and maintenance.

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