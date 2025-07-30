# API Provider Configuration Guide

## 🎯 **Overview**

The Market Intelligence system now supports **configurable API provider enabling/disabling** through `application.properties` and environment variables. This replaces the previous dummy-key logic with explicit control over which APIs are active.

## 🔧 **Configuration Options**

### **1. Application Properties**

```properties
# Scrapingdog API (Primary - Most Cost-Effective)
discovery.scrapingdog.key=${SCRAPINGDOG_KEY:dummy_scrapingdog_key}
discovery.scrapingdog.base-url=${SCRAPINGDOG_BASE_URL:https://api.scrapingdog.com/google}
discovery.scrapingdog.max-results=${SCRAPINGDOG_MAX_RESULTS:10}
discovery.scrapingdog.enabled=${SCRAPINGDOG_ENABLED:true}

# Serper API (Secondary - Fast Fallback)
discovery.serper.key=${SERPER_KEY:dummy_serper_key}
discovery.serper.base-url=${SERPER_BASE_URL:https://google.serper.dev/search}
discovery.serper.max-results=${SERPER_MAX_RESULTS:10}
discovery.serper.enabled=${SERPER_ENABLED:true}

# SerpAPI (Tertiary - Google Shopping results)
discovery.serpapi.key=${SERPAPI_KEY:dummy_serpapi_key}
discovery.serpapi.base-url=${SERPAPI_BASE_URL:https://serpapi.com/search.json}
discovery.serpapi.max-results=${SERPAPI_MAX_RESULTS:3}
discovery.serpapi.enabled=${SERPAPI_ENABLED:true}
```

### **2. Environment Variables**

```bash
# API Keys (required for enabled providers)
SCRAPINGDOG_KEY=your_scrapingdog_key
SERPER_KEY=your_serper_key
SERPAPI_KEY=your_serpapi_key

# Enable/Disable Flags (optional - defaults to true)
SCRAPINGDOG_ENABLED=true
SERPER_ENABLED=true
SERPAPI_ENABLED=true
```

## 🎛️ **Usage Scenarios**

### **Scenario 1: Enable Only Scrapingdog (Cost Optimization)**
```bash
# Environment Variables
SCRAPINGDOG_KEY=your_key
SCRAPINGDOG_ENABLED=true
SERPER_ENABLED=false
SERPAPI_ENABLED=false
```

**Result**: Only Scrapingdog API will be used for price scraping and discovery.

### **Scenario 2: Enable Scrapingdog + Serper (Balanced)**
```bash
# Environment Variables
SCRAPINGDOG_KEY=your_key
SERPER_KEY=your_key
SCRAPINGDOG_ENABLED=true
SERPER_ENABLED=true
SERPAPI_ENABLED=false
```

**Result**: Scrapingdog as primary, Serper as fallback (both $0.001 cost).

### **Scenario 3: Enable All APIs (Maximum Reliability)**
```bash
# Environment Variables
SCRAPINGDOG_KEY=your_key
SERPER_KEY=your_key
SERPAPI_KEY=your_key
SCRAPINGDOG_ENABLED=true
SERPER_ENABLED=true
SERPAPI_ENABLED=true
```

**Result**: Full fallback chain with all APIs available.

### **Scenario 4: Disable All APIs (Free-Only Mode)**
```bash
# Environment Variables
SCRAPINGDOG_ENABLED=false
SERPER_ENABLED=false
SERPAPI_ENABLED=false
```

**Result**: Only free Jsoup scraping will be used (no API costs).

## 📊 **API Provider Comparison**

| Provider | Cost per Request | Priority | Use Case | Config Flag |
|----------|------------------|----------|----------|-------------|
| Scrapingdog | $0.001 | Primary | First API choice | `SCRAPINGDOG_ENABLED` |
| Serper | $0.001 | Secondary | Backup to Scrapingdog | `SERPER_ENABLED` |
| SerpAPI | $0.015 | Tertiary | Last resort (expensive) | `SERPAPI_ENABLED` |

## 🔍 **Implementation Details**

### **How `isEnabled()` Works Now**

```java
// ScrapingdogSearchClient
@Override
public boolean isEnabled() {
    return enabled && apiKey != null && !apiKey.equals("dummy_scrapingdog_key");
}

// SerperSearchClient  
@Override
public boolean isEnabled() {
    return enabled && apiKey != null && !apiKey.equals("dummy_serper_key");
}

// SerpApiSearchClient
@Override
public boolean isEnabled() {
    return enabled; // enabled is set in initializeSecrets()
}
```

### **Configuration Priority**
1. **Config Flag**: `discovery.{provider}.enabled` (from application.properties)
2. **Environment Variable**: `{PROVIDER}_ENABLED` (overrides config)
3. **API Key Validation**: Still checks for valid API key
4. **Final State**: All conditions must be true for provider to be enabled

## 🧪 **Testing & Verification**

### **Check Provider Status**
```bash
# API endpoint to check provider status
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://your-domain.com/api/competitors/discovery/config"
```

**Expected Response**:
```json
{
  "enabled": true,
  "configured": true,
  "searchProvider": "MultiSource (Scrapingdog: enabled, Serper: enabled, SerpAPI: disabled)",
  "searchClientEnabled": true
}
```

### **Log Messages**
```
INFO  - Scrapingdog enabled: true
INFO  - Serper enabled: true  
INFO  - SerpAPI enabled: false
INFO  - Initialized MultiSourceSearchClient with 2 providers: Scrapingdog, Serper
```

## 🚀 **Deployment Examples**

### **Render.com Configuration**
```yaml
# render.yaml
envVars:
  # API Keys
  - key: SCRAPINGDOG_KEY
    sync: false  # Set in Render Dashboard
  - key: SERPER_KEY
    sync: false  # Set in Render Dashboard
  - key: SERPAPI_KEY
    sync: false  # Set in Render Dashboard
  
  # Enable/Disable Flags
  - key: SCRAPINGDOG_ENABLED
    value: "true"
  - key: SERPER_ENABLED
    value: "true"
  - key: SERPAPI_ENABLED
    value: "false"  # Disable expensive SerpAPI
```

### **Docker Environment**
```bash
# docker-compose.yml
environment:
  - SCRAPINGDOG_KEY=your_key
  - SERPER_KEY=your_key
  - SCRAPINGDOG_ENABLED=true
  - SERPER_ENABLED=true
  - SERPAPI_ENABLED=false
```

## 🔄 **Migration from Old Logic**

### **Before (Dummy Key Logic)**
```java
// Old approach - only checked for dummy keys
public boolean isEnabled() {
    return apiKey != null && !apiKey.equals("dummy_scrapingdog_key");
}
```

### **After (Configurable Logic)**
```java
// New approach - explicit configuration
@Value("${discovery.scrapingdog.enabled:true}")
private boolean enabled;

public boolean isEnabled() {
    return enabled && apiKey != null && !apiKey.equals("dummy_scrapingdog_key");
}
```

## 🎯 **Benefits**

### **1. Explicit Control**
- **Before**: Had to remove API keys to disable providers
- **After**: Can explicitly enable/disable with config flags

### **2. Environment-Specific Configuration**
- **Development**: Enable all APIs for testing
- **Production**: Enable only cost-effective APIs
- **Staging**: Enable subset for validation

### **3. Cost Optimization**
- **Before**: All APIs enabled if keys present
- **After**: Can disable expensive APIs (SerpAPI) while keeping cheap ones

### **4. Better Debugging**
- **Before**: Hard to tell why provider was disabled
- **After**: Clear configuration shows enabled/disabled state

## ⚠️ **Important Notes**

### **API Key Still Required**
Even if `{PROVIDER}_ENABLED=true`, the provider will be disabled if:
- API key is not provided
- API key is dummy value
- API key is empty/null

### **Fallback Behavior**
- If primary provider is disabled, system automatically tries next enabled provider
- If all APIs are disabled, only free Jsoup scraping is used
- No errors thrown when providers are disabled

### **Configuration Precedence**
1. Environment variable overrides application.properties
2. API key validation still applies
3. All conditions must be met for provider to be enabled

---

**Summary**: The new configurable approach provides explicit control over API providers while maintaining backward compatibility and improving cost optimization capabilities. 