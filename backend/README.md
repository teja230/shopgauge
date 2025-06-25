# ShopGauge Backend

Enterprise-grade Spring Boot backend for the ShopGauge Shopify analytics platform. Built with Spring Boot 3.2.3, Java 17, and PostgreSQL, providing secure APIs, automated competitor discovery, and comprehensive data privacy compliance.

## 🚀 Live API

Production API: **[https://api.shopgaugeai.com](https://api.shopgaugeai.com)**

## 🏗️ Architecture

### Technology Stack

- **Spring Boot 3.2.3** - Modern Java framework with auto-configuration
- **Java 17** - Latest LTS version with modern language features
- **PostgreSQL 16** - Robust relational database with JSON support
- **Redis 7** - In-memory data store for sessions and caching
- **Spring WebFlux** - Reactive programming for scalable APIs
- **Spring Data JPA** - Database abstraction with Hibernate
- **Spring Session** - Redis-based session management
- **Flyway** - Database migration management

### External Integrations

- **Shopify API** - OAuth integration and merchant data access
- **SerpAPI** - Google Shopping competitor discovery
- **SendGrid** - Transactional email notifications
- **Twilio** - SMS alerts and notifications
- **Selenium WebDriver** - Web scraping for competitor data

## 📁 Project Structure

```
src/main/java/com/storesight/backend/
├── config/                    # Configuration classes
│   ├── SecretsConfig.java     # Environment-based secrets management
│   ├── WebConfig.java         # Web and CORS configuration
│   ├── WebCorsConfig.java     # Cross-origin resource sharing
│   └── WebSecurityConfig.java # Security and session configuration
├── controller/                # REST API controllers
│   ├── AdminController.java   # Admin dashboard and debug endpoints
│   ├── AnalyticsController.java # Shopify analytics and metrics
│   ├── CompetitorController.java # Competitor management
│   ├── InsightsController.java # Business insights and recommendations
│   └── ShopifyAuthController.java # OAuth authentication flow
├── model/                     # JPA entity models
│   ├── AuditLog.java         # Compliance audit logging
│   ├── CompetitorSuggestion.java # AI-discovered competitors
│   ├── Notification.java     # User notifications
│   └── Shop.java             # Shopify store data
├── repository/                # Data access layer
│   ├── AuditLogRepository.java
│   ├── CompetitorSuggestionRepository.java
│   ├── NotificationRepository.java
│   └── ShopRepository.java
├── service/                   # Business logic layer
│   ├── discovery/             # Competitor discovery services
│   │   ├── CompetitorDiscoveryService.java
│   │   ├── KeywordBuilder.java
│   │   ├── SearchClient.java
│   │   └── SerpApiSearchClient.java
│   ├── AlertService.java      # Email/SMS notifications
│   ├── CompetitorScraperWorker.java # Background web scraping
│   ├── DataPrivacyService.java # GDPR/CCPA compliance
│   ├── InsightsService.java   # Business intelligence
│   ├── NotificationService.java # User notifications
│   ├── SecretService.java     # Environment variable management
│   └── ShopService.java       # Shopify integration
└── StoresightBackendApplication.java # Main application class
```

## 🔌 API Endpoints

### Authentication
- `GET /api/auth/shopify/install` - Initiate OAuth flow
- `GET /api/auth/shopify/callback` - Handle OAuth callback
- `GET /api/auth/shopify/me` - Get current shop info
- `GET /api/auth/shopify/reauth` - Re-authenticate with updated scopes

### Analytics
- `GET /api/analytics/orders/timeseries` - Orders data with pagination
- `GET /api/analytics/revenue` - Revenue metrics and trends
- `GET /api/analytics/abandoned-carts` - Abandoned cart analytics
- `GET /api/analytics/conversion-rate` - Conversion rate metrics
- `GET /api/analytics/inventory/low` - Low inventory alerts
- `GET /api/analytics/new_products` - Recently added products
- `GET /api/analytics/permissions/check` - API permission validation
- `GET /api/analytics/audit-logs` - Compliance audit logs

### Competitor Intelligence
- `GET /api/competitors` - List tracked competitors
- `POST /api/competitors` - Add new competitor
- `DELETE /api/competitors/{id}` - Remove competitor
- `GET /api/competitors/suggestions` - AI-discovered suggestions
- `POST /api/competitors/suggestions/{id}/approve` - Approve suggestion
- `POST /api/competitors/suggestions/{id}/ignore` - Ignore suggestion

### Admin & Debug
- `GET /api/admin/debug` - API access diagnostics
- `GET /api/admin/secrets` - Environment variable status
- `GET /api/admin/integrations/status` - External service status
- `POST /api/admin/integrations/test` - Test email/SMS integrations

### Business Insights
- `GET /api/insights` - Dashboard insights and recommendations

## 🚀 Getting Started

### Prerequisites

- **Java 17** or higher
- **PostgreSQL 15+** (PostgreSQL 16 recommended)
- **Redis 7** or higher
- **Gradle 8** (included via wrapper)

### Local Development

```bash
# Navigate to backend directory
cd backend

# Set up environment variables (see Environment Variables section)
cp .env.example .env
# Edit .env with your configuration

# Start PostgreSQL and Redis (using Docker)
docker run -d --name postgres -e POSTGRES_PASSWORD=storesight -p 5432:5432 postgres:16
docker run -d --name redis -p 6379:6379 redis:7

# Run database migrations
./gradlew flywayMigrate

# Start the application
./gradlew bootRun

# The API will be available at http://localhost:8080
```

### Testing

```bash
# Run unit tests
./gradlew test

# Run integration tests with TestContainers
./gradlew integrationTest

# Run all tests
./gradlew check

# Generate test reports
./gradlew jacocoTestReport
```

### Code Quality

```bash
# Format code with Google Java Format
./gradlew spotlessApply

# Check code formatting
./gradlew spotlessCheck

# Run all quality checks
./gradlew check
```

## ⚙️ Configuration

### Environment Variables

```bash
# Database Configuration
DB_URL=jdbc:postgresql://localhost:5432/storesight
DB_USER=storesight
DB_PASS=storesight

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Shopify Integration (Required)
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_REDIRECT_URI=http://localhost:8080/api/auth/shopify/callback

# External Services (Optional)
SERPAPI_KEY=your_serpapi_key
SENDGRID_API_KEY=your_sendgrid_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM_NUMBER=+1234567890

# Application Configuration
SERVER_PORT=8080
FRONTEND_URL=http://localhost:5173
SPRING_PROFILES_ACTIVE=default
```

### Application Profiles

- **default** - Standard web application mode
- **worker** - Background worker mode for scheduled tasks
- **test** - Testing configuration with embedded databases

### Database Migrations

Flyway migrations are located in `src/main/resources/db/migration/`:

```
V1__init.sql                    # Initial schema
V2__create_shops_table.sql      # Shop management
V3__create_daily_metrics_table.sql # Analytics storage
V11__competitor_suggestions.sql # AI discovery
V12__create_audit_logs_table.sql # Compliance logging
```

## 🔒 Security Features

### Authentication & Authorization
- **Shopify OAuth 2.0** - Secure merchant authentication
- **Session Management** - Redis-based session persistence
- **CORS Protection** - Multi-origin support for development/production
- **Authorization Code Protection** - Prevents replay attacks

### Data Privacy & Compliance
- **GDPR/CCPA Compliance** - Automatic data retention and deletion
- **Audit Logging** - Complete audit trail with IP tracking
- **Data Minimization** - Only essential data processed
- **Encryption** - Secure handling of sensitive data

### Security Headers
- **HttpOnly Cookies** - Prevents XSS attacks
- **Secure Cookies** - HTTPS-only transmission
- **SameSite Protection** - CSRF prevention

## 🔄 Background Workers

### Scheduled Tasks

```java
// Competitor Discovery - Daily at 3:45 AM
@Scheduled(cron = "0 45 3 * * *")
public void discoverCompetitorsForAllShops()

// Competitor Scraping - Daily at 2:15 AM  
@Scheduled(cron = "0 15 2 * * *")
public void scrapeCompetitors()

// Alert Processing - Every 10 seconds
@Scheduled(fixedDelay = 10000)
public void pollAlerts()
```

### Worker Profile

Run background workers separately:

```bash
./gradlew bootRun --args='--spring.profiles.active=worker'
```

## 📊 Monitoring & Observability

### Health Checks
- `GET /actuator/health` - Application health status
- `GET /actuator/info` - Application information
- `GET /actuator/metrics` - Application metrics

### Logging
- **Structured Logging** - JSON format for production
- **Log Levels** - Configurable per package
- **Audit Trails** - Complete compliance logging

### Metrics
- **Database Connections** - Connection pool monitoring
- **API Response Times** - Endpoint performance tracking
- **Cache Hit Rates** - Redis performance metrics

## 🚀 Deployment

### Docker Build

```bash
# Build Docker image
docker build -t storesight-backend .

# Run with Docker Compose
docker-compose up -d
```

### Render Deployment

The application is configured for Render.com deployment:

```yaml
# render.yaml
services:
  - type: web
    name: storesight-backend
    runtime: docker
    dockerfilePath: backend/Dockerfile
    envVars:
      - key: SHOPIFY_API_KEY
        sync: false
      - key: SHOPIFY_API_SECRET
        sync: false
      # ... additional environment variables
```

### Production Checklist

- [ ] Set all required environment variables
- [ ] Configure production database with backups
- [ ] Set up Redis cluster for high availability
- [ ] Configure SSL/TLS certificates
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Test OAuth flow with production URLs
- [ ] Verify external service integrations

## 🧪 Testing Strategy

### Unit Tests
- **Service Layer** - Business logic validation
- **Repository Layer** - Data access testing
- **Controller Layer** - API endpoint testing

### Integration Tests
- **TestContainers** - Real database testing
- **WebTestClient** - Full HTTP stack testing
- **MockWebServer** - External API mocking

### Test Data
- **Flyway Test Migrations** - Consistent test data
- **Test Profiles** - Isolated test configuration
- **Mock Services** - External service simulation

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](../LICENSE) file for details.

## 🆘 Support

- **API Documentation** - Available at `/swagger-ui.html` (development)
- **Health Checks** - Monitor at `/actuator/health`
- **Issues** - Report bugs via GitHub Issues
- **Documentation** - See main README for complete setup guide

---

**Built with ❤️ for enterprise-grade Shopify analytics and competitor intelligence.** 