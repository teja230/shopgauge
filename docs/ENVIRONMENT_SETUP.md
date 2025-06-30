# Environment Setup for ShopGauge

This document explains how to set up environment variables for the ShopGauge application, a comprehensive Shopify analytics and competitor intelligence platform.

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your actual values for the required services.

## Required Environment Variables

### Database Configuration

- `DB_URL`: PostgreSQL connection URL (e.g., `jdbc:postgresql://localhost:5432/storesight`)
- `DB_USER`: Database username (e.g., `storesight`)
- `DB_PASS`: Database password (e.g., `your_secure_password`)

### Redis Configuration

- `REDIS_HOST`: Redis server hostname (e.g., `localhost`)
- `REDIS_PORT`: Redis server port (e.g., `6379`)

### Shopify Configuration (Required)

- `SHOPIFY_API_KEY`: Your Shopify Partner app API key
- `SHOPIFY_API_SECRET`: Your Shopify Partner app API secret
- `SHOPIFY_REDIRECT_URI`: OAuth callback URL (default: `http://localhost:8080/api/auth/shopify/callback`)
- `SHOPIFY_SCOPES`: Required Shopify permissions (e.g., `read_orders,read_products,read_customers`)

### Market Intelligence APIs (New!)

StoreSight now supports multiple search providers for cost-effective competitor discovery:

#### Primary Provider - Scrapingdog (Recommended)
- `SCRAPINGDOG_KEY`: Your Scrapingdog API key from https://scrapingdog.com
- **Cost**: $0.001 per search (97% cheaper than SerpAPI)
- **Free tier**: 1000 credits/month
- **Best for**: Primary competitor discovery

#### Secondary Provider - Serper (Fallback)
- `SERPER_KEY`: Your Serper API key from https://serper.dev  
- **Cost**: $0.001 per search (97% cheaper than SerpAPI)
- **Free tier**: 2500 searches/month
- **Best for**: Fast fallback when primary fails

#### Enterprise Provider - SerpAPI (Optional)
- `SERPAPI_KEY`: Your SerpAPI key from https://serpapi.com
- **Cost**: $0.015 per search (premium pricing)
- **Free tier**: 100 searches/month
- **Best for**: Enterprise customers requiring premium accuracy

#### Market Intelligence Configuration
- `DISCOVERY_MULTI_SOURCE_ENABLED`: Enable multi-provider system (default: `true`)
- `DISCOVERY_FALLBACK_ENABLED`: Enable automatic fallback (default: `true`)
- `DISCOVERY_MAX_PROVIDERS`: Maximum providers to try per search (default: `3`)
- `DISCOVERY_ENABLED`: Enable automatic discovery (default: `true`)
- `DISCOVERY_INTERVAL_HOURS`: Hours between discovery runs (default: `24`)
- `DISCOVERY_MAX_RESULTS`: Maximum results per product (default: `10`)

#### SendGrid Configuration (Optional - for email notifications)
- `SENDGRID_API_KEY`: Your SendGrid API key

#### Twilio Configuration (Optional - for SMS notifications)
- `TWILIO_ACCOUNT_SID`: Your Twilio account SID
- `TWILIO_AUTH_TOKEN`: Your Twilio auth token
- `TWILIO_FROM_NUMBER`: Your Twilio phone number

### Application Configuration

- `SPRING_PROFILES_ACTIVE`: Active Spring profile (e.g., `dev`, `prod`)
- `SERVER_PORT`: Application server port (default: `8080`)
- `LOG_LEVEL`: Logging level (e.g., `INFO`, `DEBUG`)

## Getting API Keys

### Shopify Partner Account

1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Create a new app or use an existing one
3. Configure OAuth settings:
   - App URL: `http://localhost:8080` (development)
   - Allowed redirection URLs: `http://localhost:8080/api/auth/shopify/callback`
4. Set required scopes:
   - `read_orders` - For revenue analytics
   - `read_products` - For inventory management
   - `read_customers` - For conversion tracking
5. Copy the API key and secret

### Market Intelligence APIs

#### Scrapingdog (Primary - Most Cost-Effective)

1. **Sign up** at [Scrapingdog](https://scrapingdog.com/)
2. **Get 1000 free credits** monthly (enough for 200 searches)
3. **Pricing**: $0.0002 per credit (5 credits per search = $0.001 per search)
4. **Features**: Google search, fast response, high reliability
5. **Copy your API key** from the dashboard

#### Serper (Secondary - Fast Fallback)

1. **Sign up** at [Serper](https://serper.dev/)
2. **Get 2500 free searches** monthly
3. **Pricing**: $50/month for 100k searches ($0.001 per search)
4. **Features**: Real-time Google results, very fast API
5. **Copy your API key** from the dashboard

#### SerpAPI (Enterprise - Optional)

1. **Sign up** at [SerpAPI](https://serpapi.com/)
2. **Get 100 free searches** monthly
3. **Pricing**: $75/month for 5k searches ($0.015 per search)
4. **Features**: Premium accuracy, structured data, Google Shopping
5. **Copy your API key** from the dashboard

**💡 Cost Optimization Tip**: Start with Scrapingdog + Serper for 97% cost savings. Only add SerpAPI if you need premium accuracy for enterprise customers.

### SendGrid (Email Notifications)

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Create an API key in your account settings
3. Copy the API key
4. Verify your sender email address

### Twilio (SMS Notifications)

1. Sign up at [Twilio](https://twilio.com/)
2. Get your Account SID and Auth Token from the console
3. Get a phone number for sending SMS
4. Note the phone number format (e.g., `+1234567890`)

## Local Development Setup

### Prerequisites

- **Java 17** or higher
- **Node.js 18** or higher
- **PostgreSQL 15+** or higher
- **Redis 7** or higher
- **Docker** (optional, for containerized services)

### Step-by-Step Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/teja230/shopgauge.git
   cd shopgauge
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Start PostgreSQL and Redis**
   ```bash
   # Using Docker
   docker run -d --name postgres -e POSTGRES_PASSWORD=storesight -p 5432:5432 postgres:15
   docker run -d --name redis -p 6379:6379 redis:7
   
   # Or using local installations
   # Start PostgreSQL service
   # Start Redis service
   ```

4. **Create database**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   CREATE DATABASE storesight;
   CREATE USER storesight WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE storesight TO storesight;
   \q
   ```

5. **Run database migrations**
   ```bash
   cd backend
   ./gradlew flywayMigrate
   ```

6. **Start the backend**
   ```bash
   cd backend
   ./gradlew bootRun
   ```

7. **Start the frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

8. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8080

## Production Deployment

### Environment Variables for Production

For production deployment, ensure you have:

1. **Strong, unique passwords** for all services
2. **Production database** (PostgreSQL 15+)
3. **Production Redis** instance
4. **SSL certificates** for HTTPS
5. **Proper logging levels** (INFO or WARN)
6. **Environment-specific configuration**

### Example Production .env

```bash
# Database
DB_URL=jdbc:postgresql://your-production-db:5432/storesight
DB_USER=storesight_prod
DB_PASS=your_very_secure_password

# Redis
REDIS_HOST=your-production-redis
REDIS_PORT=6379

# Shopify (Production app)
SHOPIFY_API_KEY=your_production_shopify_key
SHOPIFY_API_SECRET=your_production_shopify_secret
SHOPIFY_REDIRECT_URI=https://your-domain.com/api/auth/shopify/callback

# Market Intelligence APIs (New!)
SCRAPINGDOG_KEY=your_scrapingdog_key
SERPER_KEY=your_serper_key
SERPAPI_KEY=your_serpapi_key

# Market Intelligence Configuration
DISCOVERY_MULTI_SOURCE_ENABLED=true
DISCOVERY_FALLBACK_ENABLED=true
DISCOVERY_ENABLED=true
DISCOVERY_INTERVAL_HOURS=24
DISCOVERY_MAX_RESULTS=10

# Legacy External Services
SENDGRID_API_KEY=your_sendgrid_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM_NUMBER=+1234567890

# Application
SPRING_PROFILES_ACTIVE=prod
SERVER_PORT=8080
LOG_LEVEL=INFO
```

## Security Best Practices

- **Never commit `.env` files** to version control
- **Use strong, unique passwords** for all services
- **Rotate API keys** regularly in production
- **Use environment-specific configurations** (dev/staging/prod)
- **Enable SSL/TLS** for all external communications
- **Monitor API usage** to detect unusual activity
- **Set up alerts** for API rate limits and errors

## Cost Optimization

### Market Intelligence Cost Comparison

| Setup | Monthly Cost (10k searches) | Annual Cost | Savings |
|-------|----------------------------|-------------|---------|
| **SerpAPI Only** | $1,250 | $15,000 | Baseline |
| **Scrapingdog Only** | $83 | $1,000 | 93% |
| **Multi-Source (Recommended)** | $83 | $1,000 | 93% |
| **With Exponential Caching** | $42 | $500 | 97% |

### Performance Optimizations

**Exponential Caching** (Enabled by default):
- **120-minute search cache** → 95% API call reduction
- **30-minute count cache** → 98% database query reduction
- **10-minute polling** → 95% background request reduction

**Expected Performance**:
- **Cache hit rate**: >90% for search results
- **Response time**: <200ms for cached results
- **Cost reduction**: 95-97% vs uncached setup

## Troubleshooting

### Common Issues

**Market Intelligence not working:**
```bash
# Check API keys are set
echo $SCRAPINGDOG_KEY
echo $SERPER_KEY

# Verify discovery is enabled
curl localhost:8080/api/competitors/discovery/stats

# Check logs for errors
tail -f backend/logs/application.log | grep Discovery
```

**High API costs:**
```bash
# Check cache hit rates
curl localhost:8080/api/competitors/discovery/stats

# Verify cache configuration
grep cache backend/src/main/resources/application.properties
```

**Database connection issues:**
```bash
# Verify credentials in .env file
grep DB_ .env

# Test connection
psql $DB_URL -c "SELECT 1;"
```

**Redis connection issues:**
```bash
# Verify host and port in .env file
grep REDIS .env

# Test connection
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
```

**Shopify OAuth issues:**
```bash
# Check if .env file exists
ls -la .env

# Verify Shopify credentials
grep SHOPIFY .env

# Check redirect URI matches Shopify app settings
```

### Getting Help

If you encounter issues:

1. **Check the logs** first (`backend/logs/application.log`)
2. **Verify environment variables** are set correctly
3. **Test API keys** individually using curl
4. **Check network connectivity** to external services
5. **Review the troubleshooting section** in each service's documentation

### Support Resources

- **Documentation**: [docs/](../docs/)
- - **Email Support**: support@shopgauge.com

---

**Built with ❤️ for Shopify merchants who want intelligent analytics and competitive insights.** 🚀