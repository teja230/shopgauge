# 🔧 Developer Guide

Welcome to the StoreSight Developer Guide. This section contains APIs, integration guides, and development resources.

## 📋 Contents

### 🔌 **[Admin Endpoints Reference](ADMIN_ENDPOINTS_REFERENCE.md)**
Complete API documentation for all administrative endpoints. Authentication, session management, cache operations, and emergency procedures.

### 🏪 **[Session & Shop Management](SESSION_AND_SHOP_MANAGEMENT.md)**
Multi-session architecture implementation. Concurrent logins, session isolation, token caching, and intelligent cleanup.

### 🔐 **[Admin & Security](ADMIN_AND_SECURITY.md)**
Security implementation details. Authentication, authorization, JWT tokens, and security best practices.

### 📋 **[Setup & Compliance](SETUP_AND_COMPLIANCE.md)**
GDPR compliance, privacy policies, data retention, and regulatory requirements.

### 🤝 **[Contributing Guide](CONTRIBUTING.md)**
How to contribute to the StoreSight project. Development setup, coding standards, and pull request process.

### 📡 **[SSE Admin Card](SSE_ADMIN_CARD.md)**
Server-sent events implementation for real-time admin interface updates.

### 🛠️ **[Session Management Tools Refactor](SESSION_MANAGEMENT_TOOLS_REFACTOR.md)**
Technical details on session management system refactoring and improvements.

---

## 🚀 Quick Start for Developers

1. **Read [Contributing Guide](CONTRIBUTING.md)** for development setup
2. **Review [Admin Endpoints Reference](ADMIN_ENDPOINTS_REFERENCE.md)** for API integration
3. **Study [Session & Shop Management](SESSION_AND_SHOP_MANAGEMENT.md)** for architecture understanding
4. **Check [Admin & Security](ADMIN_AND_SECURITY.md)** for security implementation

## 🎯 Target Audience

- **Backend Developers** - API integration and server-side development
- **Frontend Developers** - Client-side integration and UI development
- **DevOps Engineers** - Deployment and infrastructure management
- **Security Engineers** - Security implementation and compliance
- **Contributors** - Open source contributors and maintainers

## 🔧 Development Stack

- **Backend**: Spring Boot 3.2.3, Java 17, PostgreSQL 16, Redis 7
- **Frontend**: React 18, TypeScript 5.5, Vite, PWA
- **Security**: AES-256-GCM encryption, JWT tokens, rate limiting
- **Infrastructure**: Docker, Render deployment, automated CI/CD

---

*For user-facing features, see the [User Guide](../user-guide/)*  
*For system architecture, see the [Architecture Guide](../architecture/)*