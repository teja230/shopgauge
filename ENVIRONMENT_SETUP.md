# Environment Setup for StoreSight

This document explains how to set up environment variables for the StoreSight application.

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your actual values for the required services.

## Required Environment Variables

### Database Configuration

- `DB_URL`: PostgreSQL connection URL
- `DB_USER`: Database username
- `DB_PASS`: Database password

### Redis Configuration

- `REDIS_HOST`: Redis server hostname
- `REDIS_PORT`: Redis server port

### Shopify Configuration (Required)

- `SHOPIFY_API_KEY`: Your Shopify Partner app API key
- `SHOPIFY_API_SECRET`: Your Shopify Partner app API secret
- `SHOPIFY_REDIRECT_URI`: OAuth callback URL (default: http://localhost:8080/api/auth/shopify/callback)
- `SHOPIFY_SCOPES`: Required Shopify permissions

### SendGrid Configuration (Optional - for email notifications)

- `SENDGRID_API_KEY`: Your SendGrid API key

### Twilio Configuration (Optional - for SMS notifications)

- `TWILIO_ACCOUNT_SID`: Your Twilio account SID
- `TWILIO_AUTH_TOKEN`: Your Twilio auth token
- `TWILIO_FROM_NUMBER`: Your Twilio phone number

### SerpAPI Configuration (Optional - for competitor discovery)

- `SERPAPI_KEY`: Your SerpAPI key from https://serpapi.com/

## Getting API Keys

### Shopify Partner Account

1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Create a new app
3. Configure OAuth settings
4. Copy the API key and secret

### SendGrid

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Create an API key in your account settings
3. Copy the API key

### Twilio

1. Sign up at [Twilio](https://twilio.com/)
2. Get your Account SID and Auth Token from the console
3. Get a phone number for sending SMS

### SerpAPI

1. Sign up at [SerpAPI](https://serpapi.com/)
2. Get your API key from the dashboard

## Development vs Production

For development, you can use the default values in `.env.example`. For production:

1. Use strong, unique passwords
2. Generate a secure JWT secret
3. Use production database and Redis instances
4. Configure proper SSL certificates
5. Set appropriate logging levels

## Security Notes

- Never commit `.env` files to version control
- Use different API keys for development and production
- Regularly rotate your API keys
- Use environment-specific configuration files
- Consider using a secrets management service for production

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
    - Check if PostgreSQL is running
    - Verify database credentials
    - Ensure database exists

2. **Redis Connection Failed**
    - Check if Redis is running
    - Verify Redis host and port
    - Test connection with `redis-cli ping`

3. **Shopify OAuth Errors**
    - Verify API key and secret
    - Check redirect URI configuration
    - Ensure app is properly configured in Shopify Partners

4. **Missing Environment Variables**
    - Check if `.env` file exists
    - Verify variable names match application.properties
    - Restart application after changing environment variables

### Environment Variable Priority

The application uses the following priority for configuration:

1. Environment variables
2. `.env` file
3. `application.properties` defaults

## Support

If you encounter issues with environment setup, check:

1. Application logs for specific error messages
2. Service documentation for API key requirements
3. Network connectivity for external services 