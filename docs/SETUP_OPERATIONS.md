# ShopGauge – Setup & Operations Guide

This document covers all operational aspects of running ShopGauge – from local development to production, plus common troubleshooting & cost-optimisation tips.

---

## 1. Local Development Quick-Start

```bash
# 1) Clone
git clone https://github.com/your-username/shopgauge.git && cd shopgauge

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

Frontend: <http://localhost:5173> – Backend: <http://localhost:8080>

---

## 2. Environment Variables (Essentials)

| Category | Variable | Example |
|----------|----------|---------|
| **PostgreSQL** | `DB_URL` | `jdbc:postgresql://localhost:5432/storesight` |
|  | `DB_USER` / `DB_PASS` | `storesight` / `secret` |
| **Redis** | `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` |
| **Shopify** | `SHOPIFY_API_KEY` | `shpka_***` |
|  | `SHOPIFY_API_SECRET` | `shpss_***` |
| **Market-Intel** | `SCRAPINGDOG_KEY` / `SERPER_KEY` / `SERPAPI_KEY` | `xxxxx` |
| **Email / SMS** | `SENDGRID_API_KEY` / `TWILIO_*` | – |

Full list lives in the `.env.example` file.

---

## 3. Production Checklist

1. Managed PostgreSQL (HA, backups, SSL).  
2. Managed Redis (persistent / multi-AZ).  
3. Set `SPRING_PROFILES_ACTIVE=prod`.  
4. Load balancer terminating TLS 1.3.  
5. API replicas behind HPA (CPU & queue length).  
6. Separate background worker pod for scheduled discovery jobs.  
7. External secrets manager (AWS Secrets Manager / Vault).  
8. Enable structured logging + central log aggregation.

---

## 4. Cost Optimisation (Market Intelligence)

| Provider | Price / 1k searches | Free Tier | Notes |
|----------|--------------------|-----------|-------|
| **Scrapingdog** | **$1** | 1 000 credits | Primary default |
| **Serper** | $1 | 2 500 searches | Fallback |
| **SerpAPI** | $15 | 100 searches | Enterprise only |

*Exponential caching* (120-min TTL) yields > 90 % hit-rate → additional 10× cost reduction.

---

## 5. Troubleshooting

| Symptom | Checks |
|---------|--------|
| **Shopify OAuth fails** | Verify API key/secret & redirect URI, ensure app in "Development" or "Published" appropriately. |
| **Discovery worker expensive** | Confirm cache TTL, review provider order & fallback flags. |
| **Redis timeouts** | Check `REDIS_HOST`, latency, maxmemory-policy. |
| **504 on /analytics/** | Backend log: look for `429` from Shopify → rate-limit backoff triggered. |
| **Email not sending** | Verify SendGrid key & verified sender. |

Tail logs:
```bash
tail -f backend/logs/application.log | grep ERROR
```

---

## 6. Zero-Downtime Deployment

1. Pre-deploy DB migration (`./gradlew flywayMigrate -Penv=prod`).
2. Roll new API pods (K8s rolling update, Surge=1).
3. Verify `/actuator/health` → `UP`.
4. Switch traffic.

---

© 2025 ShopGauge – Run with confidence. 