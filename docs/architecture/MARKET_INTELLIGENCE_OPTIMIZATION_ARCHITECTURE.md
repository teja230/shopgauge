# Market Intelligence Optimization Architecture

## 📋 Overview

This document provides comprehensive architecture diagrams and technical specifications for the Market Intelligence optimization implementation, including multi-tier caching, batch processing, write operations, cache warming, and 512MB memory profile optimizations.

## 🏗️ System Architecture

### **Complete Optimization Architecture**

```mermaid
graph TB
    subgraph "Frontend Layer"
        MI_DASH[Market Intelligence Dashboard]
        OPT_PANEL[Optimization Panel]
        ADMIN_UI[Admin Interface]
        CACHE_UI[Cache Management UI]
        BATCH_UI[Batch Management UI]
        WARMING_UI[Cache Warming UI]
    end
    
    subgraph "API Gateway"
        MI_CONTROLLER[MarketIntelligenceAdminController]
        CACHE_ENDPOINTS[Cache Endpoints]
        BATCH_ENDPOINTS[Batch Endpoints]
        WRITE_ENDPOINTS[Write Endpoints]
        WARMING_ENDPOINTS[Warming Endpoints]
        STATUS_ENDPOINTS[Status Endpoints]
    end
    
    subgraph "Optimization Services"
        CACHE_SVC[MarketIntelligenceCacheService]
        BATCH_SVC[MarketIntelligenceBatchService]
        WRITE_SVC[MarketIntelligenceWriteService]
        EVENT_SVC[MarketIntelligenceEventHandler]
        WARMING_SVC[MarketIntelligenceCacheWarmingService]
        PROPS[MarketIntelligenceOptimizationProperties]
    end
    
    subgraph "Core Services"
        KEYWORDS[ProductAwareKeywordBuilder]
        DISCOVERY[CompetitorDiscoveryService]
        SCRAPER[CompetitorScraperWorker]
        COST[CostOptimizationService]
    end
    
    subgraph "Data Layer"
        REDIS[(Redis Cache)]
        DB[(PostgreSQL)]
        MATERIALIZED[Materialized Views]
        PRODUCTS[Product Cache]
    end
    
    subgraph "External APIs"
        SHOPIFY[Shopify API]
        SCRAPINGDOG[Scrapingdog]
        SERPER[Serper]
        SERPAPI[SerpAPI]
    end
    
    %% Frontend connections
    MI_DASH --> MI_CONTROLLER
    OPT_PANEL --> MI_CONTROLLER
    ADMIN_UI --> MI_CONTROLLER
    CACHE_UI --> CACHE_ENDPOINTS
    BATCH_UI --> BATCH_ENDPOINTS
    WARMING_UI --> WARMING_ENDPOINTS
    
    %% API Gateway connections
    MI_CONTROLLER --> CACHE_SVC
    MI_CONTROLLER --> BATCH_SVC
    MI_CONTROLLER --> WRITE_SVC
    MI_CONTROLLER --> EVENT_SVC
    MI_CONTROLLER --> WARMING_SVC
    
    CACHE_ENDPOINTS --> CACHE_SVC
    BATCH_ENDPOINTS --> BATCH_SVC
    WRITE_ENDPOINTS --> WRITE_SVC
    WARMING_ENDPOINTS --> WARMING_SVC
    STATUS_ENDPOINTS --> CACHE_SVC
    STATUS_ENDPOINTS --> BATCH_SVC
    STATUS_ENDPOINTS --> WRITE_SVC
    STATUS_ENDPOINTS --> WARMING_SVC
    
    %% Service connections
    CACHE_SVC --> REDIS
    BATCH_SVC --> DB
    WRITE_SVC --> DB
    WRITE_SVC --> REDIS
    EVENT_SVC --> REDIS
    WARMING_SVC --> REDIS
    WARMING_SVC --> DB
    
    %% Core service connections
    DISCOVERY --> KEYWORDS
    KEYWORDS --> PRODUCTS
    PRODUCTS --> SHOPIFY
    PRODUCTS --> REDIS
    
    DISCOVERY --> COST
    COST --> SCRAPINGDOG
    COST --> SERPER
    COST --> SERPAPI
    
    SCRAPER --> DB
    SCRAPER --> REDIS
    
    %% Configuration
    PROPS --> CACHE_SVC
    PROPS --> BATCH_SVC
    PROPS --> WRITE_SVC
    PROPS --> WARMING_SVC
```

## 🗄️ Multi-Tier Caching Architecture

### **Cache Layer Architecture**

```mermaid
graph TB
    subgraph "L1 Cache (Frontend)"
        SESSION[Session Storage]
        LOCAL[Local Storage]
        MEMORY[In-Memory Cache]
    end
    
    subgraph "L2 Cache (Backend)"
        REDIS[(Redis Cache)]
        CACHE_SVC[MarketIntelligenceCacheService]
        TTL[TTL Management]
        COMPRESSION[Cache Compression]
    end
    
    subgraph "L3 Cache (Database)"
        DB[(PostgreSQL)]
        MATERIALIZED[Materialized Views]
        DB_CACHE[Database Cache]
        INDEXES[Optimized Indexes]
    end
    
    subgraph "Cache Management"
        INVALIDATION[Cache Invalidation]
        WARMING[Cache Warming]
        EVICTION[Smart Eviction]
        STATS[Cache Statistics]
    end
    
    %% Cache flow
    SESSION --> REDIS
    LOCAL --> REDIS
    MEMORY --> REDIS
    REDIS --> CACHE_SVC
    CACHE_SVC --> DB
    DB --> MATERIALIZED
    DB --> DB_CACHE
    DB --> INDEXES
    
    %% Management flow
    INVALIDATION --> REDIS
    WARMING --> REDIS
    EVICTION --> REDIS
    STATS --> REDIS
    
    %% TTL and compression
    TTL --> REDIS
    COMPRESSION --> REDIS
```

### **Cache Key Strategy**

```mermaid
graph LR
    subgraph "Cache Key Structure"
        SHOP[shop:domain]
        COMPONENT[component:type]
        DATA[data:identifier]
        TTL[ttl:duration]
    end
    
    subgraph "Key Examples"
        DASHBOARD[mi:dashboard:shop.com:30m]
        COST[mi:cost:shop.com:2h]
        DISCOVERY[mi:discovery:shop.com:1h]
        PROVIDER[mi:provider:shop.com:6h]
        PERFORMANCE[mi:performance:shop.com:15m]
    end
    
    SHOP --> DASHBOARD
    COMPONENT --> DASHBOARD
    DATA --> DASHBOARD
    TTL --> DASHBOARD
    
    SHOP --> COST
    COMPONENT --> COST
    DATA --> COST
    TTL --> COST
```

## 🧭 Frontend User-Facing Optimizations (L1 Session Cache)

This section documents the latest user-facing improvements implemented in the frontend L1 (session) cache and related UX flows. These optimizations provide instant UI feedback while keeping data consistent with L2 (Redis) and L3 (DB).

### L1 Session Cache: Key Design

Frontend session storage now holds a minimal, shop-scoped L1 cache for Market Intelligence:

```javascript
// Active competitors list (array)
"mi_competitors_<shop>"

// Archived competitors list (array)
"mi_archived_<shop>"

// Price history root (object) holding per-item entries
"mi_pricehistory_<shop>"  // contains keys like: "price_history_<competitorId>_90"
```

Notes:
- Shop is derived from auth context/cookies; no `current_shop` session entry is used.
- Session cache is an optimization layer. On failure or absence, the UI falls back to L2/L3.

### Surgical Cache Updates (Archive/Restore)

Archive and restore flows avoid full-list clears in session storage. Instead, we update only the affected item and reconcile in the background with L2/L3.

```mermaid
sequenceDiagram
    participant U as User
    participant A as Active UI
    participant S as L1 Session
    participant API as Backend API
    participant R as Redis (L2)
    participant DB as Database (L3)
    participant AR as Archived UI

    U->>A: Click "Archive" on competitor
    A->>S: Remove competitor from mi_competitors_<shop>
    A->>AR: Prepend stub to mi_archived_<shop> (highlight: orange)
    A->>API: POST /competitors/{id}/archive
    API->>R: Invalidate relevant MI keys
    API->>DB: Persist archive
    A->>API: Background refetch (debounced)
    API->>R: Serve fresh data (fallback DB)
    API->>AR: Replace stub with authoritative data
```

Restore mirrors the archive flow:

```mermaid
sequenceDiagram
    participant U as User
    participant AR as Archived UI
    participant S as L1 Session
    participant API as Backend API
    participant R as Redis (L2)
    participant DB as Database (L3)
    participant A as Active UI

    U->>AR: Click "Restore" on competitor
    AR->>S: Remove competitor from mi_archived_<shop>
    AR->>API: POST /competitors/{id}/restore
    API->>R: Invalidate relevant MI keys
    API->>DB: Persist restore
    A->>API: Background refetch (debounced)
    API->>A: Updated list; UI highlights restored row (green)
```

UX highlighting rules:
- Archive: highlight in Archived section only (orange). Active section does not highlight.
- Restore: highlight in Active section (green).

### Price History Session Caching

The Price History modal seeds from L1 session cache for instant rendering and writes through after API fetch:

```mermaid
sequenceDiagram
    participant U as User
    participant M as PriceHistoryModal
    participant S as L1 Session
    participant API as Backend API
    participant R as Redis (L2)

    U->>M: Open Price History
    M->>S: Read mi_pricehistory_<shop>["price_history_<id>_90"]
    alt Entry present
        S-->>M: Seed chart/table instantly
    else No entry
        M-->>M: Show loader
    end
    M->>API: GET /competitors/{id}/price-history?days=90
    API->>R: Serve cached (fallback DB)
    API-->>M: Data + statistics
    M->>S: Write-through to mi_pricehistory_<shop>
```

Key details:
- Session root renamed from `mi_cache_<shop>_v1` to `mi_pricehistory_<shop>` (no backward compatibility needed).
- Per-item entries use `price_history_<competitorId>_90` and may persist lightweight stats alongside (e.g., `${key}_stats`).
- Shop context is sourced from `useAuth()` (cookie-backed); no session duplication.

### Frontend Cache Key Reference

```javascript
// Session (L1)
"mi_competitors_<shop>"           // Active competitors
"mi_archived_<shop>"              // Archived competitors
"mi_pricehistory_<shop>"          // Price history root { price_history_<id>_90: { data, ... } }

// Redis (L2)
"mi:dashboard:{shopDomain}"
"mi:competitor_data:{shopDomain}"
"mi:discovery_stats:{shopDomain}"
"mi:price_history:{shopDomain}"
"mi:cost_analytics:{shopDomain}"
"mi:system_status:{shopDomain}"
"mi:performance_metrics:{shopDomain}"
```

### UI Correctness Enhancements

- Relative time accuracy for "Last Checked":
  - DB timestamps `yyyy-MM-dd HH:mm:ss.SSS` are treated as local time.
  - ISO timestamps with `Z` are parsed as UTC.
  - Future-dated values are clamped to `now` to avoid "in about X hours" artifacts.
  - If a relative string is already returned by the backend, it is displayed as-is.

## ⚡ Performance Optimization Architecture

### **512MB Memory Profile Architecture**

```mermaid
graph TB
    subgraph "Memory Allocation"
        APP_MEM[Application: 256MB]
        REDIS_MEM[Redis: 128MB]
        DB_MEM[Database: 128MB]
    end
    
    subgraph "Memory Optimization"
        THROTTLE[Request Throttling]
        BATCH[Batch Processing]
        COMPRESS[Cache Compression]
        EVICT[Smart Eviction]
        ASYNC[Async Processing]
    end
    
    subgraph "Resource Management"
        MONITOR[Memory Monitor]
        LIMITS[Memory Limits]
        ALERTS[Memory Alerts]
        SCALE[Auto Scaling]
    end
    
    subgraph "Performance Features"
        QUEUE[Queue Management]
        CACHE[Cache Optimization]
        INDEX[Index Optimization]
        CONNECTION[Connection Pooling]
    end
    
    APP_MEM --> MONITOR
    REDIS_MEM --> MONITOR
    DB_MEM --> MONITOR
    
    MONITOR --> LIMITS
    LIMITS --> ALERTS
    ALERTS --> SCALE
    
    THROTTLE --> APP_MEM
    BATCH --> APP_MEM
    COMPRESS --> REDIS_MEM
    EVICT --> REDIS_MEM
    ASYNC --> APP_MEM
    
    QUEUE --> APP_MEM
    CACHE --> REDIS_MEM
    INDEX --> DB_MEM
    CONNECTION --> DB_MEM
```

### **Batch Processing Architecture**

```mermaid
sequenceDiagram
    participant User as User
    participant API as API Gateway
    participant Batch as Batch Service
    participant Queue as Queue Manager
    participant DB as Database
    participant Cache as Cache Service
    participant Cost as Cost Service
    
    User->>API: Trigger Batch Operation
    API->>Batch: Process Batch Request
    Batch->>Queue: Add to Queue
    Queue->>Batch: Queue Status
    
    loop Batch Processing
        Batch->>DB: Fetch Batch Data
        DB->>Batch: Data
        Batch->>Cost: Check Budget
        Cost->>Batch: Budget Status
        
        alt Budget Available
            Batch->>DB: Process Operations
            DB->>Batch: Results
            Batch->>Cache: Update Cache
            Cache->>Batch: Cache Updated
        else Budget Exceeded
            Batch->>API: Budget Error
            API->>User: Error Response
        end
    end
    
    Batch->>API: Batch Complete
    API->>User: Success Response
```

## 🔄 Event-Driven Architecture

### **Event Flow Architecture**

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> WriteOperation: User Action
    WriteOperation --> EventPublish: Operation Complete
    EventPublish --> CacheInvalidation: Event Triggered
    CacheInvalidation --> CacheUpdate: Invalidate Keys
    CacheUpdate --> CacheWarming: Check Warming
    CacheWarming --> Idle: Warming Complete
    
    Idle --> BatchOperation: Scheduled/Manual
    BatchOperation --> BatchComplete: Processing Done
    BatchComplete --> CacheUpdate: Update Cache
    CacheUpdate --> Idle: Update Complete
    
    Idle --> ManualWarming: Admin Trigger
    ManualWarming --> WarmingStart: Priority Set
    WarmingStart --> WarmingComplete: Warming Done
    WarmingComplete --> Idle: Complete
    
    WriteOperation --> Error: Operation Failed
    Error --> Idle: Error Handled
    
    CacheInvalidation --> Error: Invalidation Failed
    Error --> Idle: Error Handled
    
    BatchOperation --> Error: Batch Failed
    Error --> Idle: Error Handled
```

### **Event Types and Handlers**

```mermaid
graph TB
    subgraph "Event Types"
        COMPETITOR_ADDED[Competitor Added]
        COMPETITOR_UPDATED[Competitor Updated]
        PRICE_SCRAPED[Price Scraped]
        COST_TRACKED[Cost Tracked]
        SYSTEM_STATUS[System Status]
        PERFORMANCE[Performance Metrics]
    end
    
    subgraph "Event Handlers"
        CACHE_INVALIDATOR[Cache Invalidator]
        BATCH_PROCESSOR[Batch Processor]
        WARMING_TRIGGER[Warming Trigger]
        STATS_UPDATER[Stats Updater]
    end
    
    subgraph "Cache Actions"
        INVALIDATE_DASHBOARD[Invalidate Dashboard]
        INVALIDATE_COST[Invalidate Cost]
        INVALIDATE_DISCOVERY[Invalidate Discovery]
        INVALIDATE_PROVIDER[Invalidate Provider]
        INVALIDATE_PERFORMANCE[Invalidate Performance]
    end
    
    COMPETITOR_ADDED --> CACHE_INVALIDATOR
    COMPETITOR_UPDATED --> CACHE_INVALIDATOR
    PRICE_SCRAPED --> CACHE_INVALIDATOR
    COST_TRACKED --> CACHE_INVALIDATOR
    SYSTEM_STATUS --> CACHE_INVALIDATOR
    PERFORMANCE --> CACHE_INVALIDATOR
    
    CACHE_INVALIDATOR --> INVALIDATE_DASHBOARD
    CACHE_INVALIDATOR --> INVALIDATE_COST
    CACHE_INVALIDATOR --> INVALIDATE_DISCOVERY
    CACHE_INVALIDATOR --> INVALIDATE_PROVIDER
    CACHE_INVALIDATOR --> INVALIDATE_PERFORMANCE
    
    COMPETITOR_ADDED --> BATCH_PROCESSOR
    PRICE_SCRAPED --> BATCH_PROCESSOR
    COST_TRACKED --> BATCH_PROCESSOR
    
    COMPETITOR_ADDED --> WARMING_TRIGGER
    SYSTEM_STATUS --> WARMING_TRIGGER
    
    COMPETITOR_ADDED --> STATS_UPDATER
    PRICE_SCRAPED --> STATS_UPDATER
    COST_TRACKED --> STATS_UPDATER
```

## 🎛️ Admin Panel Architecture

### **Admin Interface Architecture**

```mermaid
graph TB
    subgraph "Admin Interface"
        DASHBOARD[Market Intelligence Dashboard]
        OPT_PANEL[Optimization Panel]
        CACHE_MGMT[Cache Management]
        BATCH_MGMT[Batch Management]
        WARMING_MGMT[Cache Warming]
        STATUS_MGMT[Status Management]
    end
    
    subgraph "Monitoring Services"
        STATS_SVC[Statistics Service]
        HEALTH_SVC[Health Checks]
        METRICS_SVC[Performance Metrics]
        ALERTS_SVC[Alert System]
    end
    
    subgraph "Control Services"
        RESET_SVC[Reset Services]
        TRIGGER_SVC[Trigger Services]
        CLEAR_SVC[Clear Services]
        CONFIG_SVC[Configuration Services]
    end
    
    subgraph "Data Sources"
        CACHE_STATS[Cache Statistics]
        BATCH_STATS[Batch Statistics]
        WRITE_STATS[Write Statistics]
        WARMING_STATS[Warming Statistics]
        OVERALL_STATS[Overall Statistics]
    end
    
    %% Interface connections
    DASHBOARD --> STATS_SVC
    OPT_PANEL --> STATS_SVC
    CACHE_MGMT --> STATS_SVC
    BATCH_MGMT --> STATS_SVC
    WARMING_MGMT --> STATS_SVC
    STATUS_MGMT --> STATS_SVC
    
    %% Service connections
    STATS_SVC --> CACHE_STATS
    STATS_SVC --> BATCH_STATS
    STATS_SVC --> WRITE_STATS
    STATS_SVC --> WARMING_STATS
    STATS_SVC --> OVERALL_STATS
    
    %% Control connections
    CACHE_MGMT --> RESET_SVC
    BATCH_MGMT --> RESET_SVC
    WARMING_MGMT --> RESET_SVC
    
    CACHE_MGMT --> TRIGGER_SVC
    BATCH_MGMT --> TRIGGER_SVC
    WARMING_MGMT --> TRIGGER_SVC
    
    CACHE_MGMT --> CLEAR_SVC
    BATCH_MGMT --> CLEAR_SVC
    
    OPT_PANEL --> CONFIG_SVC
    STATUS_MGMT --> CONFIG_SVC
```

### **API Endpoint Architecture**

```mermaid
graph TB
    subgraph "Cache Management Endpoints"
        GET_CACHE_STATS[GET /cache/stats]
        RESET_CACHE_STATS[POST /cache/reset-stats]
        INVALIDATE_CACHE[POST /cache/invalidate]
    end
    
    subgraph "Batch Processing Endpoints"
        GET_BATCH_STATS[GET /batch/stats]
        RESET_BATCH_STATS[POST /batch/reset-stats]
        CLEAR_BATCH_QUEUES[POST /batch/clear-queues]
    end
    
    subgraph "Write Operations Endpoints"
        GET_WRITE_STATS[GET /write/stats]
        RESET_WRITE_STATS[POST /write/reset-stats]
    end
    
    subgraph "Cache Warming Endpoints"
        GET_WARMING_STATS[GET /cache/warming/stats]
        RESET_WARMING_STATS[POST /cache/warming/reset-stats]
        TRIGGER_WARMING[POST /cache/warming/trigger]
        GET_WARMING_HEALTH[GET /cache/warming/health]
    end
    
    subgraph "Comprehensive Status"
        GET_OPTIMIZATION_STATUS[GET /optimization/status]
    end
    
    subgraph "Service Layer"
        CACHE_SVC[MarketIntelligenceCacheService]
        BATCH_SVC[MarketIntelligenceBatchService]
        WRITE_SVC[MarketIntelligenceWriteService]
        WARMING_SVC[MarketIntelligenceCacheWarmingService]
    end
    
    GET_CACHE_STATS --> CACHE_SVC
    RESET_CACHE_STATS --> CACHE_SVC
    INVALIDATE_CACHE --> CACHE_SVC
    
    GET_BATCH_STATS --> BATCH_SVC
    RESET_BATCH_STATS --> BATCH_SVC
    CLEAR_BATCH_QUEUES --> BATCH_SVC
    
    GET_WRITE_STATS --> WRITE_SVC
    RESET_WRITE_STATS --> WRITE_SVC
    
    GET_WARMING_STATS --> WARMING_SVC
    RESET_WARMING_STATS --> WARMING_SVC
    TRIGGER_WARMING --> WARMING_SVC
    GET_WARMING_HEALTH --> WARMING_SVC
    
    GET_OPTIMIZATION_STATUS --> CACHE_SVC
    GET_OPTIMIZATION_STATUS --> BATCH_SVC
    GET_OPTIMIZATION_STATUS --> WRITE_SVC
    GET_OPTIMIZATION_STATUS --> WARMING_SVC
```

## 📊 Data Flow Architecture

### **Complete Data Flow**

```mermaid
sequenceDiagram
    participant User as User
    participant UI as Frontend
    participant API as Backend API
    participant Cache as Cache Service
    participant Batch as Batch Service
    participant Write as Write Service
    participant Event as Event Handler
    participant Warming as Warming Service
    participant Redis as Redis Cache
    participant DB as Database
    participant Materialized as Materialized Views
    
    User->>UI: Access Market Intelligence
    UI->>API: GET /dashboard
    API->>Cache: Check Cache
    alt Cache Hit
        Cache->>API: Return Cached Data
    else Cache Miss
        API->>DB: Fetch Fresh Data
        DB->>Materialized: Query Materialized Views
        Materialized->>DB: Optimized Data
        DB->>API: Data
        API->>Cache: Store in Cache
    end
    API->>UI: Dashboard Data
    
    User->>UI: Add Competitor
    UI->>API: POST /competitors
    API->>Write: Process Write Operation
    Write->>DB: Store Competitor
    Write->>Cache: Invalidate Related Caches
    Write->>Event: Publish Event
    Event->>Cache: Invalidate Specific Caches
    API->>UI: Success Response
    
    User->>UI: Trigger Batch Processing
    UI->>API: POST /batch/process
    API->>Batch: Queue Operations
    Batch->>DB: Process Batch
    Batch->>Cache: Update Cache
    API->>UI: Batch Complete
    
    User->>UI: Trigger Cache Warming
    UI->>API: POST /warming/trigger
    API->>Warming: Warm Cache
    Warming->>DB: Fetch Critical Data
    Warming->>Redis: Pre-load Cache
    API->>UI: Warming Complete
    
    User->>UI: View Optimization Stats
    UI->>API: GET /optimization/status
    API->>Cache: Get Cache Stats
    API->>Batch: Get Batch Stats
    API->>Write: Get Write Stats
    API->>Warming: Get Warming Stats
    API->>UI: Comprehensive Status
```

## 🔧 Configuration Architecture

### **Configuration Management**

```mermaid
graph TB
    subgraph "Configuration Sources"
        APP_PROPS[application.properties]
        DEV_PROPS[application-dev.properties]
        PROD_PROPS[application-prod.properties]
        STAGING_PROPS[application-staging.properties]
        MEMORY_PROPS[application-512mb.properties]
    end
    
    subgraph "Configuration Classes"
        OPT_PROPS[MarketIntelligenceOptimizationProperties]
        CACHE_PROPS[Cache Properties]
        BATCH_PROPS[Batch Properties]
        WRITE_PROPS[Write Properties]
        WARMING_PROPS[Warming Properties]
        MEMORY_PROPS[Memory Properties]
    end
    
    subgraph "Service Configuration"
        CACHE_SVC[MarketIntelligenceCacheService]
        BATCH_SVC[MarketIntelligenceBatchService]
        WRITE_SVC[MarketIntelligenceWriteService]
        WARMING_SVC[MarketIntelligenceCacheWarmingService]
    end
    
    APP_PROPS --> OPT_PROPS
    DEV_PROPS --> OPT_PROPS
    PROD_PROPS --> OPT_PROPS
    STAGING_PROPS --> OPT_PROPS
    MEMORY_PROPS --> OPT_PROPS
    
    OPT_PROPS --> CACHE_PROPS
    OPT_PROPS --> BATCH_PROPS
    OPT_PROPS --> WRITE_PROPS
    OPT_PROPS --> WARMING_PROPS
    OPT_PROPS --> MEMORY_PROPS
    
    CACHE_PROPS --> CACHE_SVC
    BATCH_PROPS --> BATCH_SVC
    WRITE_PROPS --> WRITE_SVC
    WARMING_PROPS --> WARMING_SVC
    MEMORY_PROPS --> CACHE_SVC
    MEMORY_PROPS --> BATCH_SVC
    MEMORY_PROPS --> WRITE_SVC
    MEMORY_PROPS --> WARMING_SVC
```

## 🚀 Deployment Architecture

### **Production Deployment**

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Load Balancer]
    end
    
    subgraph "Application Servers"
        APP1[App Server 1]
        APP2[App Server 2]
        APP3[App Server 3]
    end
    
    subgraph "Cache Layer"
        REDIS_MASTER[Redis Master]
        REDIS_SLAVE1[Redis Slave 1]
        REDIS_SLAVE2[Redis Slave 2]
    end
    
    subgraph "Database Layer"
        DB_MASTER[DB Master]
        DB_SLAVE1[DB Slave 1]
        DB_SLAVE2[DB Slave 2]
    end
    
    subgraph "Monitoring"
        MONITOR[Monitoring]
        ALERTS[Alerts]
        LOGS[Logs]
    end
    
    LB --> APP1
    LB --> APP2
    LB --> APP3
    
    APP1 --> REDIS_MASTER
    APP2 --> REDIS_MASTER
    APP3 --> REDIS_MASTER
    
    REDIS_MASTER --> REDIS_SLAVE1
    REDIS_MASTER --> REDIS_SLAVE2
    
    APP1 --> DB_MASTER
    APP2 --> DB_MASTER
    APP3 --> DB_MASTER
    
    DB_MASTER --> DB_SLAVE1
    DB_MASTER --> DB_SLAVE2
    
    APP1 --> MONITOR
    APP2 --> MONITOR
    APP3 --> MONITOR
    
    MONITOR --> ALERTS
    MONITOR --> LOGS
```

## 📈 Performance Metrics Architecture

### **Monitoring and Metrics**

```mermaid
graph TB
    subgraph "Performance Metrics"
        CACHE_HIT_RATE[Cache Hit Rate]
        RESPONSE_TIME[Response Time]
        MEMORY_USAGE[Memory Usage]
        CPU_USAGE[CPU Usage]
        ERROR_RATE[Error Rate]
    end
    
    subgraph "Business Metrics"
        COST_SAVINGS[Cost Savings]
        API_CALLS[API Calls]
        DISCOVERY_SUCCESS[Discovery Success]
        COMPETITOR_COUNT[Competitor Count]
        PRICE_UPDATES[Price Updates]
    end
    
    subgraph "System Metrics"
        REDIS_MEMORY[Redis Memory]
        DB_CONNECTIONS[DB Connections]
        QUEUE_SIZE[Queue Size]
        BATCH_PROCESSING[Batch Processing]
        WARMING_STATUS[Warming Status]
    end
    
    subgraph "Alerting"
        HIGH_MEMORY[High Memory Alert]
        LOW_CACHE_HIT[Low Cache Hit Alert]
        HIGH_ERROR_RATE[High Error Rate Alert]
        BUDGET_EXCEEDED[Budget Exceeded Alert]
        SERVICE_DOWN[Service Down Alert]
    end
    
    CACHE_HIT_RATE --> HIGH_MEMORY
    RESPONSE_TIME --> HIGH_ERROR_RATE
    MEMORY_USAGE --> HIGH_MEMORY
    ERROR_RATE --> HIGH_ERROR_RATE
    
    COST_SAVINGS --> BUDGET_EXCEEDED
    API_CALLS --> BUDGET_EXCEEDED
    
    REDIS_MEMORY --> HIGH_MEMORY
    DB_CONNECTIONS --> SERVICE_DOWN
    QUEUE_SIZE --> HIGH_MEMORY
    BATCH_PROCESSING --> HIGH_ERROR_RATE
    WARMING_STATUS --> SERVICE_DOWN
```

## 🎯 Key Architectural Principles

### **1. Multi-Tier Caching**
- **L1**: Frontend session/local storage
- **L2**: Redis cache with TTL management
- **L3**: Database with materialized views

### **2. Event-Driven Architecture**
- Asynchronous event processing
- Loose coupling between services
- Real-time cache invalidation

### **3. Memory Profile Optimization**
- 512MB memory allocation strategy
- Request throttling and batch processing
- Smart cache eviction and compression

### **4. Scalable Design**
- Horizontal scaling support
- Load balancing ready
- Database read replicas

### **5. Monitoring and Observability**
- Comprehensive metrics collection
- Real-time alerting
- Performance monitoring

This architecture provides a robust, scalable, and performant foundation for Market Intelligence optimization that can handle enterprise-grade workloads while maintaining optimal resource utilization. 