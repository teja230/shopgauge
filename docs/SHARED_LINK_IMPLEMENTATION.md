# Shared Link Storage Implementation

## Overview

This document provides detailed technical implementation for the shared link storage system in ShopGauge, designed for our single pricing tier of $19.99/month with reasonable limits and 3-day default expiration.

## Pricing & Limits Structure

### Single Tier Pricing ($19.99/month)
- **Shared Links Included**: 50 active shared links per store
- **Default Expiration**: 3 days (72 hours)
- **Maximum Expiration**: 30 days
- **Storage per Link**: ~50-200 KB (chart data + metadata)
- **Total Storage Allowance**: ~10 MB per store (50 links × 200 KB)

### Overage Policy
- **Overage Rate**: $0.25 per additional shared link
- **Automatic Cleanup**: Expired links automatically removed
- **Grace Period**: 24 hours before overage charges apply
- **Notification**: Users notified at 80% and 100% usage

## Technical Architecture

### Database Schema

```sql
-- Shared links table
CREATE TABLE shared_links (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shop_id BIGINT NOT NULL,
    link_token VARCHAR(64) UNIQUE NOT NULL,
    chart_data JSON NOT NULL,
    chart_metadata JSON,
    chart_title VARCHAR(255) NOT NULL,
    chart_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    access_count INT DEFAULT 0,
    last_accessed_at TIMESTAMP NULL,
    is_public BOOLEAN DEFAULT true,
    created_by_session VARCHAR(255),
    
    INDEX idx_shop_id (shop_id),
    INDEX idx_token (link_token),
    INDEX idx_expires (expires_at),
    INDEX idx_shop_expires (shop_id, expires_at),
    
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Usage tracking table
CREATE TABLE shared_link_usage (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shop_id BIGINT NOT NULL,
    month_year VARCHAR(7) NOT NULL, -- Format: 2024-01
    active_links_count INT DEFAULT 0,
    total_links_created INT DEFAULT 0,
    total_accesses INT DEFAULT 0,
    overage_links INT DEFAULT 0,
    overage_charges DECIMAL(10,2) DEFAULT 0.00,
    
    UNIQUE KEY unique_shop_month (shop_id, month_year),
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);
```

### Backend Implementation

#### Shared Link Service

```java
@Service
public class SharedLinkService {
    
    private static final int MAX_LINKS_PER_STORE = 50;
    private static final int DEFAULT_EXPIRATION_DAYS = 3;
    private static final int MAX_EXPIRATION_DAYS = 30;
    private static final BigDecimal OVERAGE_RATE = new BigDecimal("0.25");
    
    @Autowired
    private SharedLinkRepository sharedLinkRepository;
    
    @Autowired
    private ShopRepository shopRepository;
    
    public SharedLinkResponse createSharedLink(CreateSharedLinkRequest request) {
        // Validate shop exists
        Shop shop = shopRepository.findByShopifyDomain(request.getShopDomain())
            .orElseThrow(() -> new ShopNotFoundException("Shop not found"));
        
        // Check current usage
        int activeLinks = sharedLinkRepository.countActiveByShopId(shop.getId());
        boolean isOverage = activeLinks >= MAX_LINKS_PER_STORE;
        
        // Calculate expiration
        LocalDateTime expiresAt = calculateExpiration(request.getExpirationDays());
        
        // Generate secure token
        String token = generateSecureToken();
        
        // Create shared link
        SharedLink sharedLink = new SharedLink();
        sharedLink.setShopId(shop.getId());
        sharedLink.setLinkToken(token);
        sharedLink.setChartData(request.getChartData());
        sharedLink.setChartMetadata(request.getMetadata());
        sharedLink.setChartTitle(request.getChartTitle());
        sharedLink.setChartType(request.getChartType());
        sharedLink.setExpiresAt(expiresAt);
        sharedLink.setCreatedBySession(request.getSessionId());
        
        sharedLink = sharedLinkRepository.save(sharedLink);
        
        // Update usage tracking
        updateUsageTracking(shop.getId(), isOverage);
        
        // Generate public URL
        String publicUrl = generatePublicUrl(token);
        
        return SharedLinkResponse.builder()
            .linkId(sharedLink.getId())
            .publicUrl(publicUrl)
            .embedCode(generateEmbedCode(token))
            .expiresAt(expiresAt)
            .isOverage(isOverage)
            .remainingLinks(Math.max(0, MAX_LINKS_PER_STORE - activeLinks - 1))
            .build();
    }
    
    public SharedLinkData getSharedLink(String token) {
        SharedLink link = sharedLinkRepository.findByLinkToken(token)
            .orElseThrow(() -> new SharedLinkNotFoundException("Link not found"));
        
        // Check expiration
        if (link.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new SharedLinkExpiredException("Link has expired");
        }
        
        // Update access tracking
        link.setAccessCount(link.getAccessCount() + 1);
        link.setLastAccessedAt(LocalDateTime.now());
        sharedLinkRepository.save(link);
        
        return SharedLinkData.builder()
            .chartData(link.getChartData())
            .chartMetadata(link.getChartMetadata())
            .chartTitle(link.getChartTitle())
            .chartType(link.getChartType())
            .createdAt(link.getCreatedAt())
            .accessCount(link.getAccessCount())
            .build();
    }
    
    private String generateSecureToken() {
        return UUID.randomUUID().toString().replace("-", "") + 
               System.currentTimeMillis();
    }
    
    private LocalDateTime calculateExpiration(Integer requestedDays) {
        int days = requestedDays != null ? 
            Math.min(requestedDays, MAX_EXPIRATION_DAYS) : 
            DEFAULT_EXPIRATION_DAYS;
        return LocalDateTime.now().plusDays(days);
    }
    
    private String generatePublicUrl(String token) {
        return String.format("%s/shared/%s", getBaseUrl(), token);
    }
    
    private String generateEmbedCode(String token) {
        return String.format(
            "<iframe src=\"%s/embed/%s\" width=\"800\" height=\"600\" frameborder=\"0\"></iframe>",
            getBaseUrl(), token
        );
    }
}
```

#### REST Controller

```java
@RestController
@RequestMapping("/api/shared-links")
public class SharedLinkController {
    
    @Autowired
    private SharedLinkService sharedLinkService;
    
    @PostMapping("/create")
    public ResponseEntity<SharedLinkResponse> createSharedLink(
            @RequestBody CreateSharedLinkRequest request,
            HttpServletRequest httpRequest) {
        
        String shopDomain = (String) httpRequest.getSession().getAttribute("shop");
        request.setShopDomain(shopDomain);
        request.setSessionId(httpRequest.getSession().getId());
        
        try {
            SharedLinkResponse response = sharedLinkService.createSharedLink(request);
            return ResponseEntity.ok(response);
        } catch (ShopNotFoundException e) {
            return ResponseEntity.badRequest().body(null);
        } catch (SharedLinkLimitExceededException e) {
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
                .body(SharedLinkResponse.builder()
                    .error("Shared link limit exceeded")
                    .overageRate(OVERAGE_RATE)
                    .build());
        }
    }
    
    @GetMapping("/usage")
    public ResponseEntity<UsageResponse> getUsage(HttpServletRequest request) {
        String shopDomain = (String) request.getSession().getAttribute("shop");
        UsageResponse usage = sharedLinkService.getUsageStats(shopDomain);
        return ResponseEntity.ok(usage);
    }
    
    @DeleteMapping("/{linkId}")
    public ResponseEntity<Void> deleteSharedLink(
            @PathVariable Long linkId,
            HttpServletRequest request) {
        
        String shopDomain = (String) request.getSession().getAttribute("shop");
        sharedLinkService.deleteSharedLink(linkId, shopDomain);
        return ResponseEntity.ok().build();
    }
}
```

#### Public Access Controller

```java
@RestController
@RequestMapping("/shared")
public class PublicSharedLinkController {
    
    @Autowired
    private SharedLinkService sharedLinkService;
    
    @GetMapping("/{token}")
    public ResponseEntity<String> getSharedChart(@PathVariable String token) {
        try {
            SharedLinkData data = sharedLinkService.getSharedLink(token);
            
            // Generate HTML page with chart
            String html = generateChartHtml(data);
            
            return ResponseEntity.ok()
                .header("Content-Type", "text/html")
                .body(html);
                
        } catch (SharedLinkNotFoundException | SharedLinkExpiredException e) {
            return ResponseEntity.notFound().build();
        }
    }
    
    @GetMapping("/api/{token}")
    public ResponseEntity<SharedLinkData> getSharedChartData(@PathVariable String token) {
        try {
            SharedLinkData data = sharedLinkService.getSharedLink(token);
            return ResponseEntity.ok(data);
        } catch (SharedLinkNotFoundException | SharedLinkExpiredException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
```

### Frontend Implementation

#### Enhanced Share Modal Updates

```typescript
// Update expiration options for single pricing tier
const EXPIRATION_OPTIONS = [
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days (recommended)' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days (maximum)' },
];

// Usage tracking component
const SharedLinkUsage: React.FC = () => {
  const [usage, setUsage] = useState<UsageStats | null>(null);
  
  useEffect(() => {
    fetchUsage();
  }, []);
  
  const fetchUsage = async () => {
    try {
      const response = await fetch('/api/shared-links/usage');
      const data = await response.json();
      setUsage(data);
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    }
  };
  
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Shared Links Usage
        </Typography>
        
        {usage && (
          <Box>
            <LinearProgress 
              variant="determinate" 
              value={(usage.activeLinks / 50) * 100}
              sx={{ mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              {usage.activeLinks} / 50 active shared links
            </Typography>
            
            {usage.activeLinks >= 40 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                You're approaching your shared link limit. 
                Consider removing expired links or upgrading your plan.
              </Alert>
            )}
            
            {usage.overageLinks > 0 && (
              <Alert severity="info" sx={{ mt: 1 }}>
                You have {usage.overageLinks} overage links this month.
                Additional charge: ${(usage.overageLinks * 0.25).toFixed(2)}
              </Alert>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
```

## Storage & Performance Optimization

### Data Compression
```typescript
// Compress chart data before storage
const compressChartData = (data: any): string => {
  // Remove redundant data
  const optimized = {
    series: data.series?.map((item: any) => ({
      date: item.date,
      value: item.value,
      // Only include essential fields
    })),
    metadata: {
      type: data.type,
      title: data.title,
      timeRange: data.timeRange,
    }
  };
  
  // JSON compression
  return JSON.stringify(optimized);
};
```

### Automatic Cleanup Service
```java
@Service
@Scheduled(fixedRate = 3600000) // Run every hour
public class SharedLinkCleanupService {
    
    @Autowired
    private SharedLinkRepository sharedLinkRepository;
    
    public void cleanupExpiredLinks() {
        LocalDateTime now = LocalDateTime.now();
        
        // Find expired links
        List<SharedLink> expiredLinks = sharedLinkRepository
            .findByExpiresAtBefore(now);
        
        // Delete expired links
        sharedLinkRepository.deleteAll(expiredLinks);
        
        logger.info("Cleaned up {} expired shared links", expiredLinks.size());
    }
    
    @Scheduled(cron = "0 0 2 * * ?") // Run daily at 2 AM
    public void updateUsageStatistics() {
        // Update monthly usage statistics
        // Calculate overage charges
        // Send usage notifications
    }
}
```

## Security Features

### Token Security
- **Cryptographically Secure**: UUID + timestamp for uniqueness
- **Non-Predictable**: Tokens cannot be guessed or enumerated
- **Single Use Session**: Optional single-use tokens for sensitive data
- **IP Restrictions**: Optional IP whitelisting for enterprise customers

### Access Control
```java
public class SharedLinkSecurityService {
    
    public boolean validateAccess(String token, HttpServletRequest request) {
        SharedLink link = getSharedLink(token);
        
        // Check expiration
        if (link.getExpiresAt().isBefore(LocalDateTime.now())) {
            return false;
        }
        
        // Rate limiting (100 requests per hour per IP)
        String clientIp = getClientIpAddress(request);
        if (!rateLimitService.isAllowed(clientIp, token)) {
            return false;
        }
        
        // Optional: Check referrer restrictions
        if (link.hasReferrerRestrictions()) {
            String referrer = request.getHeader("Referer");
            if (!link.isReferrerAllowed(referrer)) {
                return false;
            }
        }
        
        return true;
    }
}
```

## Monitoring & Analytics

### Usage Metrics
- **Link Creation Rate**: Tracks creation patterns
- **Access Patterns**: Peak usage times and geographic distribution
- **Expiration Analysis**: How long links are typically used
- **Popular Chart Types**: Most shared chart categories

### Performance Monitoring
- **Response Times**: API endpoint performance
- **Storage Usage**: Database growth tracking
- **Cache Hit Rates**: CDN and application cache efficiency
- **Error Rates**: Failed link creations and access attempts

## Cost Analysis

### Storage Costs (per 1000 stores)
```
Base Storage: 50 links × 200 KB × 1000 stores = 10 GB
Monthly Growth: ~20% (2 GB additional)
Total Monthly Storage: ~12 GB
Estimated AWS S3 Cost: $0.30/month
CDN Bandwidth: ~100 GB/month = $8.50/month
Total Infrastructure: ~$9/month for 1000 stores
```

### Revenue Model
```
Monthly Revenue: 1000 stores × $19.99 = $19,990
Infrastructure Costs: $9
Gross Margin: 99.95%
```

## Implementation Timeline

### Phase 1 (Week 1): Core Infrastructure
- [ ] Database schema creation
- [ ] Basic shared link service
- [ ] Token generation and validation
- [ ] Public access endpoints

### Phase 2 (Week 2): Frontend Integration
- [ ] Updated share modal with usage tracking
- [ ] Link management dashboard
- [ ] Usage notifications
- [ ] Embed code generation

### Phase 3 (Week 3): Security & Optimization
- [ ] Rate limiting implementation
- [ ] Data compression
- [ ] Automatic cleanup service
- [ ] Performance monitoring

### Phase 4 (Week 4): Testing & Launch
- [ ] Load testing
- [ ] Security audit
- [ ] Documentation completion
- [ ] Production deployment

## Support & Maintenance

### Common Issues
1. **Link Not Found**: Usually expired or deleted
2. **Access Denied**: Rate limiting or security restrictions
3. **Slow Loading**: CDN cache misses or large chart data

### Troubleshooting Tools
- Link validation API endpoint
- Usage analytics dashboard
- Performance monitoring alerts
- Automated health checks

This implementation provides a robust, scalable shared link system that fits our single pricing tier while maintaining professional features and reasonable usage limits. 