# Setup & Compliance - Comprehensive Guide

> **Migration Note**: This document consolidates content from:
> - `ENVIRONMENT_SETUP.md`
> - `SETUP_OPERATIONS.md`
> - `COMPLIANCE_PRIVACY.md`
> - `PRIVACY_POLICY.md`
> - `SHOPIFY_PROTECTED_DATA_REQUEST.md`

## 📋 Executive Summary

This document covers all operational aspects of running ShopGauge – from local development to production, plus compliance requirements, privacy policies, and cost-optimization tips. This is the **single source of truth** for setup, operations, and compliance.

## 🚀 Quick Start Guide

### 1. **Local Development Setup**
```bash
# 1) Clone repository
git clone https://github.com/teja230/shopgauge.git && cd shopgauge

# 2) Environment variables
cp config/.env.example .env   # edit values

# 3) Start backing services (Docker)
docker run -d --name postgres -e POSTGRES_PASSWORD=storesight -p 5432:5432 postgres:15
docker run -d --name redis -p 6379:6379 redis:7

# 4) Database migrations
cd backend && ./gradlew flywayMigrate && cd ..

# 5) Start services
./gradlew -p backend bootRun   # Spring API
npm --prefix frontend install && npm --prefix frontend run dev
```

**Access Points**:
- Frontend: <http://localhost:5173>
- Backend: <http://localhost:8080>
- API Docs: <http://localhost:8080/api/docs>

## 🔧 Environment Configuration

### Required Environment Variables

| Category | Variable | Example | Required |
|----------|----------|---------|----------|
| **PostgreSQL** | `DB_URL` | `jdbc:postgresql://localhost:5432/storesight` | ✅ |
|  | `DB_USER` / `DB_PASS` | `storesight` / `secret` | ✅ |
| **Redis** | `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | ✅ |
| **Shopify** | `SHOPIFY_API_KEY` | `shpka_***` | ✅ |
|  | `SHOPIFY_API_SECRET` | `shpss_***` | ✅ |
| **Market Intelligence** | `SCRAPINGDOG_KEY` / `SERPER_KEY` / `SERPAPI_KEY` | `xxxxx` | ⚠️ |
| **Email / SMS** | `SENDGRID_API_KEY` / `TWILIO_*` | – | ⚠️ |
| **Admin** | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `secure_pass` | ✅ |

### Environment File Structure
```bash
# .env file structure
# Database Configuration
DB_URL=jdbc:postgresql://localhost:5432/storesight
DB_USER=storesight
DB_PASS=your_secure_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Shopify Configuration
SHOPIFY_API_KEY=shpka_your_api_key
SHOPIFY_API_SECRET=shpss_your_api_secret
SHOPIFY_REDIRECT_URI=http://localhost:8080/api/auth/shopify/callback
SHOPIFY_SCOPES=read_orders,read_products,read_customers

# Market Intelligence APIs
SCRAPINGDOG_KEY=your_scrapingdog_key
SERPER_KEY=your_serper_key
SERPAPI_KEY=your_serpapi_key

# Email/SMS Configuration
SENDGRID_API_KEY=your_sendgrid_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token

# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password
JWT_SECRET=your_jwt_secret_key

# Application Configuration
SPRING_PROFILES_ACTIVE=dev
SERVER_PORT=8080
```

## 🏭 Production Deployment

### 1. **Production Checklist**
- [ ] Managed PostgreSQL (HA, backups, SSL)
- [ ] Managed Redis (persistent / multi-AZ)
- [ ] Set `SPRING_PROFILES_ACTIVE=prod`
- [ ] Load balancer terminating TLS 1.3
- [ ] API replicas behind HPA (CPU & queue length)
- [ ] Separate background worker pod for scheduled discovery jobs
- [ ] External secrets manager (AWS Secrets Manager / Vault)
- [ ] Enable structured logging + central log aggregation

### 2. **Production Environment Variables**
```bash
# Production-specific variables
SPRING_PROFILES_ACTIVE=prod
SERVER_PORT=443
DB_URL=jdbc:postgresql://your-prod-db:5432/storesight
REDIS_HOST=your-prod-redis
ADMIN_PASSWORD=your_very_secure_production_password
JWT_SECRET=your_production_jwt_secret
```

### 3. **SSL Configuration**
```yaml
server:
  ssl:
    key-store: classpath:keystore.p12
    key-store-password: your_keystore_password
    key-store-type: PKCS12
  port: 443
```

### 4. **Security Headers**
```java
@Configuration
public class SecurityHeadersConfig {
    
    @Bean
    public FilterRegistrationBean<HeaderWriterFilter> securityHeadersFilter() {
        HeaderWriterFilter filter = new HeaderWriterFilter(
            Arrays.asList(
                new XFrameOptionsHeaderWriter(),
                new XXssProtectionHeaderWriter(),
                new ContentTypeOptionsHeaderWriter(),
                new HstsHeaderWriter()
            )
        );
        
        return new FilterRegistrationBean<>(filter);
    }
}
```

## 💰 Cost Optimization

### Market Intelligence Cost Analysis

| Provider | Price / 1k searches | Free Tier | Best For |
|----------|---------------------|-----------|----------|
| **Scrapingdog** | $0.001 | 1000/month | Primary discovery |
| **Serper** | $0.001 | 2500/month | Fast fallback |
| **SerpAPI** | $0.015 | 100/month | Enterprise backup |

### Cost Optimization Strategies
1. **Use Scrapingdog as primary** (97% cheaper than SerpAPI)
2. **Implement intelligent caching** (95% cost reduction)
3. **Set daily limits** to prevent cost overruns
4. **Monitor usage** with real-time analytics
5. **Use free tiers** for development and testing

### Budget Recommendations
- **Solo Developer**: $5-10/day for comprehensive market intelligence
- **Small Business**: $20-50/day for high-volume monitoring
- **Enterprise**: $100+/day for unlimited competitive analysis

## 🔒 Compliance & Privacy

### GDPR Compliance

#### Data Processing Principles
1. **Lawfulness, Fairness, and Transparency**
   - Clear privacy policy and data processing notices
   - Explicit consent for data collection
   - Transparent data handling practices

2. **Purpose Limitation**
   - Data collected only for specified, legitimate purposes
   - No processing beyond original purpose without consent

3. **Data Minimization**
   - Only collect data necessary for service provision
   - Regular data audits and cleanup

4. **Accuracy**
   - Maintain accurate and up-to-date data
   - Allow users to correct inaccurate data

5. **Storage Limitation**
   - Data retention policies with automatic deletion
   - 365-day retention for audit logs

6. **Integrity and Confidentiality**
   - AES-256 encryption at rest
   - TLS 1.3 encryption in transit
   - Access controls and audit logging

#### User Rights Implementation
- **Right to Access**: Users can request their data
- **Right to Rectification**: Users can correct inaccurate data
- **Right to Erasure**: Users can request data deletion
- **Right to Portability**: Users can export their data
- **Right to Object**: Users can object to data processing

### CCPA Compliance

#### California Consumer Privacy Act
1. **Notice at Collection**
   - Clear disclosure of data collection practices
   - Purpose of data collection and use

2. **Right to Know**
   - Consumers can request data disclosure
   - Detailed information about data practices

3. **Right to Delete**
   - Consumers can request data deletion
   - Verification of identity before deletion

4. **Right to Opt-Out**
   - Clear opt-out mechanisms
   - No discrimination for exercising rights

### Shopify Protected Data Compliance

#### Level 2 Protected Data Requirements
1. **Data Encryption**
   - AES-256 encryption at rest
   - TLS 1.3 encryption in transit
   - Secure key management

2. **Access Controls**
   - Role-based access control (RBAC)
   - Multi-factor authentication (MFA)
   - Session management and timeout

3. **Audit Logging**
   - Comprehensive audit trail
   - 365-day retention period
   - Real-time monitoring and alerts

4. **Data Handling**
   - Secure data processing
   - Data minimization practices
   - Secure data disposal

## 📋 Privacy Policy

### Data Collection

#### Information We Collect
1. **Shop Information**
   - Shop domain and basic details
   - Shopify access tokens (encrypted)
   - Shop preferences and settings

2. **Usage Data**
   - Session information and activity logs
   - Feature usage and analytics
   - Performance metrics and error logs

3. **Technical Data**
   - IP addresses and device information
   - Browser type and version
   - Operating system and platform

#### How We Use Your Data
1. **Service Provision**
   - Provide analytics and insights
   - Enable market intelligence features
   - Support multi-session functionality

2. **Service Improvement**
   - Analyze usage patterns
   - Improve performance and reliability
   - Develop new features

3. **Security and Compliance**
   - Prevent fraud and abuse
   - Comply with legal obligations
   - Maintain system security

### Data Protection

#### Security Measures
1. **Encryption**
   - AES-256 encryption for data at rest
   - TLS 1.3 encryption for data in transit
   - Secure key management practices

2. **Access Controls**
   - Role-based access control
   - Multi-factor authentication
   - Session management and timeout

3. **Monitoring and Auditing**
   - Real-time security monitoring
   - Comprehensive audit logging
   - Regular security assessments

#### Data Retention
- **Active Data**: Retained while account is active
- **Audit Logs**: 365-day retention period
- **Backup Data**: 30-day retention for disaster recovery
- **Deleted Data**: Permanently deleted after retention period

### Your Rights

#### Data Subject Rights
1. **Access**: Request a copy of your data
2. **Rectification**: Correct inaccurate data
3. **Erasure**: Request data deletion
4. **Portability**: Export your data
5. **Objection**: Object to data processing
6. **Restriction**: Limit data processing

#### How to Exercise Your Rights
- **Email**: privacy@shopgauge.com
- **Support Portal**: https://support.shopgauge.com
- **Response Time**: Within 30 days of request

## 🛠️ Operations Guide

### 1. **Regular Maintenance Tasks**

#### Daily Tasks
- Review audit logs for suspicious activity
- Monitor system health and performance
- Check error rates and response times

#### Weekly Tasks
- Review performance metrics and resource usage
- Update security patches and dependencies
- Backup configuration and critical data

#### Monthly Tasks
- Review and rotate admin passwords
- Analyze cost optimization opportunities
- Update compliance documentation

#### Quarterly Tasks
- Security audit and penetration testing
- Performance optimization review
- Compliance assessment and updates

### 2. **Backup Procedures**

#### Database Backup
```bash
# Daily backup
pg_dump storesight > backup_$(date +%Y%m%d).sql

# Weekly backup with compression
pg_dump storesight | gzip > backup_$(date +%Y%m%d).sql.gz

# Verify backup integrity
pg_restore --list backup_$(date +%Y%m%d).sql
```

#### Redis Backup
```bash
# Manual backup
redis-cli BGSAVE

# Verify backup
redis-cli LASTSAVE
```

#### Configuration Backup
```bash
# Backup configuration files
cp -r config/ backup/config_$(date +%Y%m%d)/

# Backup environment variables
cp .env backup/env_$(date +%Y%m%d)
```

### 3. **Update Procedures**

#### Application Updates
```bash
# 1. Backup current deployment
cp -r /opt/shopgauge /opt/shopgauge_backup

# 2. Deploy new version
./deploy.sh

# 3. Verify deployment
curl -X GET http://localhost:8080/api/health/overview

# 4. Rollback if necessary
./rollback.sh
```

#### Database Migrations
```bash
# Run migrations
cd backend && ./gradlew flywayMigrate

# Verify migration status
./gradlew flywayInfo

# Rollback if necessary
./gradlew flywayRepair
```

### 4. **Monitoring and Alerts**

#### Key Metrics to Monitor
- **Response Time**: Target < 200ms average
- **Error Rate**: Target < 1% error rate
- **Uptime**: Target > 99.9% availability
- **Resource Usage**: CPU < 80%, Memory < 80%

#### Alert Configuration
```java
@Component
public class HealthAlertService {
    
    @Scheduled(fixedRate = 60000) // Every minute
    public void checkSystemHealth() {
        HealthStatus health = healthService.getSystemHealth();
        
        if (!health.isHealthy()) {
            sendAlert("System health check failed: " + health.getMessage());
        }
    }
}
```

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
**Symptoms**: 500 errors, slow responses
**Solutions**:
- Check database pool status: `/api/health/database-pool`
- Verify database connectivity
- Review connection pool configuration

#### Redis Connection Issues
**Symptoms**: Session failures, cache misses
**Solutions**:
- Check Redis health: `/api/health/redis`
- Verify Redis connectivity
- Review Redis configuration

#### Authentication Issues
**Symptoms**: 401 Unauthorized errors
**Solutions**:
- Verify JWT token expiration
- Check admin credentials in environment
- Review audit logs for failed attempts

### Debug Endpoints
```http
# Enable debug logging
GET /api/admin/debug/enable
Authorization: Bearer YOUR_JWT_TOKEN

# Get system diagnostics
GET /api/admin/debug/diagnostics
Authorization: Bearer YOUR_JWT_TOKEN

# Check specific component health
GET /api/health/redis
GET /api/health/database-pool
GET /api/health/sessions
```

## ✅ Implementation Checklist

- [x] **Environment Setup** with all required variables
- [x] **Production Deployment** with SSL and security headers
- [x] **Cost Optimization** with intelligent provider selection
- [x] **GDPR Compliance** with data protection measures
- [x] **CCPA Compliance** with consumer rights implementation
- [x] **Shopify Protected Data** Level 2 compliance
- [x] **Privacy Policy** with comprehensive data handling
- [x] **Backup Procedures** for disaster recovery
- [x] **Monitoring & Alerts** for proactive management
- [x] **Troubleshooting Tools** for debugging issues

## 🚀 Future Enhancements

### Planned Improvements
1. **Advanced Security**: Multi-factor authentication
2. **Enhanced Monitoring**: Real-time dashboards
3. **Automated Compliance**: Automated compliance checks
4. **Advanced Analytics**: Performance insights
5. **Enterprise Features**: Advanced permissions and roles

### Technical Roadmap
1. **Microservices Architecture**: Separate services for scalability
2. **Event-Driven Updates**: Real-time monitoring
3. **Machine Learning**: Predictive maintenance
4. **Advanced Security**: Zero-trust architecture
5. **Enterprise Features**: Team collaboration and advanced permissions

---

The Setup & Compliance system provides comprehensive guidance for deployment, operations, and compliance requirements for the ShopGauge platform. 