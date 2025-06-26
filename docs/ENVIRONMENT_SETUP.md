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

- `DB_URL`: PostgreSQL connection URL (e.g., `jdbc:postgresql://localhost:5432/shopgauge`)
- `DB_USER`: Database username (e.g., `shopgauge`)
- `DB_PASS`: Database password (e.g., `your_secure_password`)

### Redis Configuration

- `REDIS_HOST`: Redis server hostname (e.g., `localhost`)
- `REDIS_PORT`: Redis server port (e.g., `6379`)

### Shopify Configuration (Required)

- `SHOPIFY_API_KEY`: Your Shopify Partner app API key
- `SHOPIFY_API_SECRET`: Your Shopify Partner app API secret
- `SHOPIFY_REDIRECT_URI`: OAuth callback URL (default: `http://localhost:8080/api/auth/shopify/callback`)
- `SHOPIFY_SCOPES`: Required Shopify permissions (e.g., `read_orders,read_products,read_customers`)

### AI & External Services

#### SerpAPI Configuration (Optional - for AI competitor discovery)
- `SERPAPI_KEY`: Your SerpAPI key from https://serpapi.com/

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

### SerpAPI (AI Competitor Discovery)

1. Sign up at [SerpAPI](https://serpapi.com/)
2. Get your API key from the dashboard
3. Choose a plan that supports Google Shopping searches

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
   git clone https://github.com/your-username/shopgauge.git
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
   docker run -d --name postgres -e POSTGRES_PASSWORD=shopgauge -p 5432:5432 postgres:15
   docker run -d --name redis -p 6379:6379 redis:7
   
   # Or using local installations
   # Start PostgreSQL service
   # Start Redis service
   ```

4. **Create database**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   CREATE DATABASE shopgauge;
   CREATE USER shopgauge WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE shopgauge TO shopgauge;
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
DB_URL=jdbc:postgresql://your-production-db:5432/shopgauge
DB_USER=shopgauge_prod
DB_PASS=your_very_secure_password

# Redis
REDIS_HOST=your-production-redis
REDIS_PORT=6379

# Shopify (Production app)
SHOPIFY_API_KEY=your_production_shopify_key
SHOPIFY_API_SECRET=your_production_shopify_secret
SHOPIFY_REDIRECT_URI=https://your-domain.com/api/auth/shopify/callback

# External Services
SERPAPI_KEY=your_serpapi_key
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

### Environment Variable Security

- **Never commit `.env` files** to version control
- **Use different API keys** for development and production
- **Regularly rotate** your API keys
- **Use environment-specific** configuration files
- **Consider using a secrets management service** for production

### Database Security

- **Use strong passwords** for database access
- **Limit database access** to application servers only
- **Enable SSL connections** for production databases
- **Regular backups** with encryption

### API Key Management

- **Store API keys securely** in environment variables
- **Use least privilege** principle for API permissions
- **Monitor API usage** for unusual activity
- **Have a key rotation strategy**

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   sudo systemctl status postgresql
   
   # Test connection
   psql -h localhost -U shopgauge -d shopgauge
   
   # Verify credentials in .env file
   ```

2. **Redis Connection Failed**
   ```bash
   # Check if Redis is running
   sudo systemctl status redis
   
   # Test connection
   redis-cli ping
   
   # Verify host and port in .env file
   ```

3. **Shopify OAuth Errors**
   - Verify API key and secret in Shopify Partners
   - Check redirect URI configuration
   - Ensure app is properly configured with required scopes
   - Check app status (not in development mode for production)

4. **Missing Environment Variables**
   ```bash
   # Check if .env file exists
   ls -la .env
   
   # Verify variable names match application.properties
   # Restart application after changing environment variables
   ```

5. **Frontend Build Issues**
   ```bash
   # Clear node_modules and reinstall
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   
   # Check for TypeScript errors
   npm run build
   ```

### Environment Variable Priority

The application uses the following priority for configuration:

1. **Environment variables** (highest priority)
2. **`.env` file**
3. **`application.properties` defaults** (lowest priority)

### Debug Mode

To enable debug mode for troubleshooting:

```bash
# Set debug logging
LOG_LEVEL=DEBUG

# Enable Spring Boot debug
SPRING_PROFILES_ACTIVE=dev

# Check application logs
tail -f backend/logs/application.log
```

## Support

If you encounter issues with environment setup:

1. **Check application logs** for specific error messages
2. **Verify service documentation** for API key requirements
3. **Test network connectivity** for external services
4. **Review this documentation** for common solutions
5. **Open an issue** on GitHub with detailed error information

### Useful Commands

```bash
# Check Java version
java -version

# Check Node.js version
node --version

# Check PostgreSQL version
psql --version

# Check Redis version
redis-server --version

# Test database connection
psql -h localhost -U shopgauge -d shopgauge -c "SELECT version();"

# Test Redis connection
redis-cli ping

# Check application health
curl http://localhost:8080/actuator/health
```

---

**Last Updated**: June 26, 2025  
**Version**: 2.0  
**Compatible with**: ShopGauge v1.0+ 