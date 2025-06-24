# StoreSight - Shopify Analytics Dashboard

StoreSight is a modern, real-time analytics dashboard for Shopify stores that provides comprehensive insights into
revenue, orders, abandoned carts, conversion rates, inventory management, and competitor tracking with seamless Shopify
integration.

## 🏗️ Architecture Overview

### System Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React Dashboard<br/>TypeScript + Vite + MUI]
        Auth[Authentication Context]
        API[API Client<br/>Fetch with Auth]
        Pages[Dashboard, Competitors, Admin, Profile]
    end
    
    subgraph "Backend Layer"
        Gateway[Spring Boot Gateway<br/>Port 8080]
        Controllers[REST Controllers<br/>Analytics, Auth, Competitors, Insights]
        Services[Business Services<br/>Shop, Insights, Notifications, Alerts]
        Security[Security Layer<br/>CORS + OAuth]
    end
    
    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL<br/>Shops, Metrics, Notifications)]
        Redis[(Redis<br/>Tokens, Cache, Secrets)]
        Shopify[Shopify API<br/>Orders, Products, Customers]
    end
    
    subgraph "External Services"
        Competitors[Web Scraping<br/>Competitor Data<br/>Selenium + JSoup]
        Notifications[Email/SMS<br/>SendGrid + Twilio]
        Discovery[Competitor Discovery<br/>SerpAPI Integration]
    end
    
    UI --> Auth
    Auth --> API
    API --> Gateway
    Gateway --> Controllers
    Controllers --> Services
    Services --> PostgreSQL
    Services --> Redis
    Services --> Shopify
    Services --> Competitors
    Services --> Notifications
    Services --> Discovery
    
    style UI fill:#e1f5fe
    style Gateway fill:#f3e5f5
    style PostgreSQL fill:#e8f5e8
    style Shopify fill:#fff3e0
``` 

## 🔄 Authentication Flow

### Shopify OAuth Integration

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Shopify
    participant Redis
    
    User->>Frontend: Access Dashboard
    Frontend->>Backend: GET /api/auth/shopify/me
    Backend->>Redis: Check shop token
    
    alt No Token Found
        Backend->>Frontend: 401 Unauthorized
        Frontend->>User: Redirect to Login
        User->>Frontend: Enter shop domain
        Frontend->>Backend: GET /api/auth/shopify/install?shop=domain
        Backend->>Shopify: OAuth Authorization Request
        Shopify->>User: Authorization Page
        User->>Shopify: Grant Permissions
        Shopify->>Backend: GET /callback?code=auth_code
        Backend->>Shopify: Exchange code for access_token
        Shopify->>Backend: access_token
        Backend->>Redis: Store token with shop
        Backend->>Frontend: Set shop cookie & redirect
        Frontend->>User: Dashboard with data
    else Token Exists
        Backend->>Frontend: 200 OK with shop info
        Frontend->>Backend: Fetch analytics data
        Backend->>Shopify: API calls with token
        Shopify->>Backend: Store data
        Backend->>Frontend: Analytics response
        Frontend->>User: Dashboard with data
    end
``` 

## 📊 Data Flow Architecture

### Real-time Analytics Pipeline

```mermaid
graph LR
    subgraph "Data Sources"
        S1[Shopify Orders API]
        S2[Shopify Products API]
        S3[Shopify Customers API]
        S4[Competitor Websites]
        S5[SerpAPI Discovery]
    end
    
    subgraph "Data Processing"
        Cache[Redis Cache<br/>5min TTL]
        Transform[Data Transformation<br/>Aggregation & Metrics]
        Enrich[Data Enrichment<br/>URLs & Links]
        Worker[Background Worker<br/>Scraping & Alerts]
        Discovery[Competitor Discovery<br/>Automated Suggestions]
    end
    
    subgraph "Storage"
        DB[(PostgreSQL<br/>Persistent Data)]
        Memory[(Redis<br/>Session & Cache)]
        Secrets[(Redis<br/>Encrypted Secrets)]
    end
    
    subgraph "Frontend Components"
        Dashboard[Dashboard Page]
        Metrics[Metric Cards]
        Revenue[Revenue Chart]
        Competitors[Competitor Table]
        Insights[Insight Banners]
        Suggestions[Competitor Suggestions]
    end
    
    S1 --> Cache
    S2 --> Cache
    S3 --> Cache
    S4 --> Worker
    S5 --> Discovery
    
    Cache --> Transform
    Transform --> Enrich
    Worker --> Transform
    Discovery --> Transform
    Enrich --> DB
    Enrich --> Memory
    
    Memory --> Dashboard
    DB --> Dashboard
    Secrets --> Dashboard
    Dashboard --> Metrics
    Dashboard --> Revenue
    Dashboard --> Competitors
    Dashboard --> Insights
    Dashboard --> Suggestions
    
    style Cache fill:#ffeb3b
    style Transform fill:#4caf50
    style Worker fill:#ff9800
    style Discovery fill:#9c27b0
    style Dashboard fill:#2196f3
``` 

## 🔌 API Architecture

### Core Endpoints

| Endpoint                           | Method          | Purpose                             | Authentication |
|------------------------------------|-----------------|-------------------------------------|----------------|
| `/api/auth/shopify/install`        | GET             | Initiate OAuth flow                 | None           |
| `/api/auth/shopify/callback`       | GET             | Handle OAuth callback               | None           |
| `/api/auth/shopify/reauth`         | GET             | Re-authenticate with updated scopes | Cookie         |
| `/api/auth/me`                     | GET             | Get current shop info               | Cookie         |
| `/api/analytics/orders/timeseries` | GET             | Orders data with pagination         | Cookie         |
| `/api/analytics/revenue`           | GET             | Revenue metrics                     | Cookie         |
| `/api/analytics/abandoned-carts`   | GET             | Abandoned cart analytics            | Cookie         |
| `/api/analytics/conversion-rate`   | GET             | Conversion rate metrics             | Cookie         |
| `/api/analytics/inventory/low`     | GET             | Low inventory items                 | Cookie         |
| `/api/analytics/new_products`      | GET             | Recently added products             | Cookie         |
| `/api/analytics/permissions/check` | GET             | Check API permissions               | Cookie         |
| `/api/competitors`                 | GET/POST/DELETE | Competitor management               | Cookie         |
| `/api/competitors/suggestions`     | GET/POST/DELETE | Competitor discovery suggestions    | Cookie         |
| `/api/insights`                    | GET             | Dashboard insights                  | Cookie         |
| `/api/admin/debug`                 | GET             | Debug API access issues             | Cookie         |
| `/api/admin/secrets`               | GET/POST/DELETE | Manage encrypted secrets            | Cookie         |
| `/api/admin/integrations/status`   | GET             | Check integration status            | Cookie         |
| `/api/admin/integrations/test`     | POST            | Test email/SMS integrations         | Cookie         |

### Error Handling & Permission Management

```mermaid
graph TD
    Request[API Request] --> Auth{Authenticated?}
    Auth -->|No| Unauthorized[401 Unauthorized]
    Auth -->|Yes| Shopify[Shopify API Call]
    
    Shopify --> Success{Success?}
    Success -->|200 OK| Cache[Cache Response<br/>5min TTL]
    Success -->|403 Forbidden| PermError[Protected Customer Data Error]
    Success -->|429 Rate Limit| RateLimit[Rate Limit Handler]
    Success -->|Other Error| GenError[Generic Error Handler]
    
    PermError --> PermResponse[Return: error_code: INSUFFICIENT_PERMISSIONS<br/>message: Re-authentication required]
    RateLimit --> Fallback[Return Cached Data<br/>or Empty Response]
    GenError --> ErrorResponse[Return: error: API unavailable]
    
    Cache --> Response[200 OK with Data]
    PermResponse --> Frontend1[Frontend: Show Re-auth Button]
    Fallback --> Frontend2[Frontend: Show Cached Data]
    ErrorResponse --> Frontend3[Frontend: Show Error Message]
    
    style PermError fill:#ff9800
    style RateLimit fill:#f44336
    style Cache fill:#4caf50
    style Success fill:#2196f3
```

## 🛠️ Technology Stack

### Frontend

- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI) v7 with custom theme
- **Additional UI**: Tailwind CSS for utility classes
- **Routing**: React Router v6
- **Charts**: Recharts for data visualization
- **HTTP Client**: Fetch API with authentication wrapper
- **Build Tool**: Vite
- **Development**: Hot reload, TypeScript checking

### Backend

- **Framework**: Spring Boot 3.2.3
- **Language**: Java 17+
- **Web**: Spring Web MVC + WebFlux (Hybrid)
- **Security**: Spring Security with OAuth2
- **Database**: Spring Data JPA with PostgreSQL
- **Caching**: Spring Data Redis (Reactive + Traditional)
- **Migrations**: Flyway
- **Build Tool**: Gradle
- **Web Scraping**: Selenium WebDriver + JSoup
- **Background Processing**: Spring Scheduling

### Infrastructure

- **Database**: PostgreSQL 14+
- **Cache**: Redis 6+ (sessions, cache, encrypted secrets)
- **Deployment**: Render.com (via render.yaml)
- **Monitoring**: Spring Actuator
- **Logging**: SLF4J with Logback

## ✨ Features

### Core Analytics

- 📈 **Real-time Revenue Tracking** - Live revenue metrics and trends with historical data
- 📦 **Order Analytics** - Order volume, trends, and customer insights with timeseries data
- 🛒 **Abandoned Cart Analysis** - Track and analyze abandoned cart rates and recovery opportunities
- 📊 **Conversion Rate Monitoring** - Real-time conversion rate tracking with industry benchmarks
- 🛍️ **Product Performance** - Top products, sales metrics, inventory levels
- 📊 **Interactive Dashboards** - Responsive charts and visualizations with real-time updates
- 🔄 **Automatic Data Sync** - Real-time synchronization with Shopify APIs

### Competitor Intelligence

- 🏪 **Competitor Price Monitoring** - Real-time tracking of competitor prices and products
- 🔍 **Automated Competitor Discovery** - AI-powered suggestions for new competitors to track
- 📊 **Competitor Analytics** - Price change alerts, market positioning, and trend analysis
- 🔄 **Web Scraping Engine** - Automated data collection from competitor websites
- 📧 **Price Change Alerts** - Instant notifications when competitors change prices
- 📋 **Competitor Management** - Add, remove, and organize competitor tracking

### Advanced Features

- 📧 **Automated Alerts** - Email/SMS notifications for key events and threshold breaches
- 📋 **Custom Reports** - Scheduled reports and data exports
- 🔍 **Low Inventory Alerts** - Proactive inventory management with automated notifications
- 📱 **Mobile Responsive** - Full mobile and tablet support with responsive design
- 🔐 **Privacy Compliance** - Built-in privacy controls and GDPR/CCPA compliance
- 🔧 **Secret Management** - Encrypted secret storage in Redis with admin interface
- 🔄 **Store Switching** - Seamless switching between multiple Shopify stores

### Integration Features

- 🔐 **Shopify OAuth** - Secure authentication with proper scopes and token management
- 🔄 **Permission Management** - Graceful handling of API limitations and Protected Customer Data restrictions
- 💾 **Smart Caching** - Redis caching for improved performance and reduced API calls
- 🛡️ **Error Handling** - Comprehensive error recovery and user-friendly error messages
- 🔗 **Deep Links** - Direct links to Shopify admin pages for seamless navigation
- 🔍 **Debug Tools** - Built-in debugging endpoints for troubleshooting API access issues

## 💰 Pricing

### Pro Plan - $19.99/month

**Everything you need to grow your Shopify business:**

- ✅ Track unlimited competitors
- ✅ Real-time price monitoring
- ✅ Automated alerts (Email & SMS)
- ✅ Advanced analytics dashboard
- ✅ Competitor discovery tools
- ✅ Shopify integration
- ✅ Data export capabilities
- ✅ Priority support
- ✅ GDPR/CCPA compliance

**Start with a 3-day free trial - no credit card required!**

## 🚀 Quick Start

### Prerequisites

- **Java 17+** (for backend)
- **Node.js 18+** (for frontend)
- **PostgreSQL 14+** (for database)
- **Redis 6+** (for caching)
- **Shopify Partner Account** (for API credentials)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/storesight.git
cd storesight
```

### 2. Backend Setup

```bash
cd backend

# Configure application properties
# Edit src/main/resources/application.properties with your settings:
# - Database connection
# - Redis connection  
# - Shopify API credentials
# - External service keys

# Build and run
./gradlew bootRun
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server (no .env file needed for local development)
npm run dev
```

### 4. Database Setup

```bash
# Create database
createdb storesight

# Run migrations (handled automatically by Flyway)
# Migrations are in: backend/src/main/resources/db/migration/
```

## 📝 Configuration

### Backend Configuration (`application.properties`)

```properties
# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/storesight
spring.datasource.username=storesight
spring.datasource.password=storesight
# Redis
spring.data.redis.host=localhost
spring.data.redis.port=6379

# Shopify API
shopify.api.key=${SHOPIFY_API_KEY:}
shopify.api.secret=${SHOPIFY_API_SECRET:}
shopify.scopes=read_products,read_orders,read_customers,read_inventory
shopify.redirect_uri=${SHOPIFY_REDIRECT_URI:http://localhost:8080/api/auth/shopify/callback}
# Competitor Discovery (SerpAPI)
discovery.serpapi.key=${SERPAPI_KEY:dummy_serpapi_key}
discovery.enabled=${DISCOVERY_ENABLED:false}
discovery.provider=${DISCOVERY_PROVIDER:serpapi}
# External Services
sendgrid.api-key=${SENDGRID_API_KEY:dummy_sendgrid_key}
twilio.account_sid=${TWILIO_ACCOUNT_SID:dummy_twilio_sid}
twilio.auth_token=${TWILIO_AUTH_TOKEN:dummy_twilio_token}
twilio.from_number=${TWILIO_FROM_NUMBER:+1234567890}
# Frontend URL
frontend.url=${FRONTEND_URL:http://localhost:5173}

# Server
server.port=${SERVER_PORT:8080}
```

### Frontend Configuration

No environment file needed for local development. The frontend automatically connects to `http://localhost:8080` for the
backend API.

## 🔧 Development

### Running in Development Mode

```bash
# Terminal 1: Backend
cd backend && ./gradlew bootRun

# Terminal 2: Frontend  
cd frontend && npm run dev

# Terminal 3: Database (if using Docker)
docker run --name storesight-postgres -e POSTGRES_DB=storesight -e POSTGRES_USER=storesight -e POSTGRES_PASSWORD=storesight -p 5432:5432 -d postgres:14

# Terminal 4: Redis (if using Docker)
docker run --name storesight-redis -p 6379:6379 -d redis:6
```

### Building for Production

```bash
# Backend
cd backend
./gradlew build
java -jar build/libs/storesight-backend-*.jar

# Frontend
cd frontend
npm run build
# Serve the dist/ directory with your web server
```

## 📚 API Documentation

### Shopify Integration

The application integrates with Shopify using OAuth 2.0 and requires the following scopes:

- `read_products` - Access product catalog and inventory
- `read_orders` - Access order history and analytics
- `read_customers` - Access customer data and insights
- `read_inventory` - Access inventory levels and alerts

### Protected Customer Data

⚠️ **Important**: The app requires special approval from Shopify for Protected Customer Data access. This includes:

- Order details and customer information
- Revenue analytics and financial data
- Customer behavior insights

To enable full functionality:

1. Contact Shopify Partner Support
2. Request Protected Customer Data access
3. Re-authenticate your app after approval

### Rate Limiting

- Shopify API: 40 requests per app per store per minute
- Application implements intelligent caching and request batching
- Graceful degradation when rate limits are exceeded

### Error Codes

| Code                        | Description                         | Resolution                                     |
|-----------------------------|-------------------------------------|------------------------------------------------|
| `INSUFFICIENT_PERMISSIONS`  | Missing Shopify API scopes          | Re-authenticate via `/api/auth/shopify/reauth` |
| `PROTECTED_DATA_RESTRICTED` | Protected Customer Data restriction | Contact Shopify for app approval               |
| `RATE_LIMITED`              | Shopify API rate limit exceeded     | Wait and retry, cached data served             |
| `SHOPIFY_UNAVAILABLE`       | Shopify API temporarily unavailable | Cached data served, retry automatically        |

## 🚢 Deployment

### Render.com Deployment

The application is configured for deployment on Render.com using the `render.yaml` configuration:

```bash
# Deploy to Render.com
# 1. Connect your GitHub repository to Render
# 2. The render.yaml file will automatically configure:
#    - Web service (backend)
#    - Worker service (background tasks)
#    - Static site (frontend)
# 3. Set environment variables in Render dashboard
```

### Production Checklist

- [ ] Configure production database
- [ ] Set up Redis cluster
- [ ] Configure HTTPS/SSL
- [ ] Set production Shopify app credentials
- [ ] Configure monitoring and logging
- [ ] Set up backup procedures
- [ ] Configure load balancing (if needed)
- [ ] Request Protected Customer Data access from Shopify
- [ ] Set up secret encryption key (`SECRETS_ENCRYPTION_KEY`)
- [ ] Configure SerpAPI for competitor discovery
- [ ] Set up SendGrid/Twilio for notifications

## 🧪 Testing

### Backend Tests

```bash
cd backend
./gradlew test
```

### Frontend Tests

```bash
cd frontend
npm test
```

### Integration Tests

```bash
cd backend
./gradlew integrationTest
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and conventions
- Add tests for new features
- Update documentation for API changes
- Ensure all tests pass before submitting PR

## 🆘 Support & Troubleshooting

### Common Issues

**403 Forbidden Errors (Protected Customer Data)**

- Cause: Shopify Protected Customer Data restrictions
- Solution: Contact Shopify Partner Support for app approval, then re-authenticate

**Empty Dashboard Data**

- Cause: New store with no orders/products or API permission issues
- Solution: Add products and test orders in Shopify, check API permissions

**Connection Errors**

- Cause: Database or Redis connection issues
- Solution: Check connection strings and service status

**OAuth Authentication Issues**

- Cause: Incorrect app credentials or redirect URIs
- Solution: Verify Shopify app settings and environment variables

**Secret Management Issues**

- Cause: Missing or invalid encryption key
- Solution: Set `SECRETS_ENCRYPTION_KEY` environment variable (16+ characters)

**Competitor Discovery Not Working**

- Cause: SerpAPI key not configured or invalid
- Solution: Set `SERPAPI_KEY` environment variable or add via Admin interface

### Getting Help

- 📧 Email: support@storesight.com
- 💬 GitHub Issues: [Create an issue](https://github.com/your-org/storesight/issues)
- 📖 Documentation: [Full docs](https://docs.storesight.com)

## 📄 License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for Shopify merchants who want better insights into their business.**

# Competitor Discovery

## Configuration

StoreSight uses a **hybrid configuration pattern** that follows the same approach as Shopify integration:

1. **Environment Variables** (primary)
2. **Redis SecretService** (fallback)
3. **Application Properties** (defaults)

### Environment Variables (Recommended)

```bash
# SerpAPI Configuration
SERPAPI_KEY=your_actual_serpapi_key_here
DISCOVERY_PROVIDER=serpapi
DISCOVERY_ENABLED=true
```

### Redis SecretService (Admin Interface)

If environment variables are not available, the system will automatically fallback to encrypted secrets stored in Redis:

- Access the Admin page at `/admin` (when authenticated)
- Add secret key: `serpapi.api.key` with your actual API key
- The system will automatically detect and use this value

### Configuration Priority

1. **Environment Variable**: `${SERPAPI_KEY:}`
2. **Redis Secret**: `serpapi.api.key` (encrypted)
3. **Default**: `dummy_serpapi_key` (disabled)

### Production Deployment

For production, set environment variables through your hosting platform:

**Render.com:**

```bash
# Environment Variables
SERPAPI_KEY=your_production_serpapi_key
DISCOVERY_ENABLED=true
SECRETS_ENCRYPTION_KEY=your_32_character_encryption_key
```

**Local Development:**

```bash
# application.properties (for testing)
discovery.serpapi.key=dummy_serpapi_key
discovery.enabled=false
```

This pattern ensures:

- ✅ **Security**: No secrets in code or config files
- ✅ **Flexibility**: Multiple configuration sources
- ✅ **Fallback**: Graceful degradation when API unavailable
- ✅ **Consistency**: Same pattern as Shopify, SendGrid, Twilio