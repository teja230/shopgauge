# ShopGauge Monitoring and Alerting Setup Guide

This guide provides comprehensive instructions for setting up monitoring dashboards and alerting for the ShopGauge application.

## Overview

The ShopGauge application includes comprehensive monitoring capabilities with:

- **Application Metrics Collection**: Custom metrics for sessions, SSE connections, cache performance, and database operations
- **Health Check Endpoints**: Detailed health checks for all critical services
- **Alerting System**: Intelligent alerting for high memory usage, connection pool exhaustion, and stuck sessions
- **Monitoring Dashboards**: Real-time monitoring data aggregation and visualization
- **Log Aggregation**: Error pattern analysis and log aggregation support

## Available Endpoints

### Health Check Endpoints

- `GET /api/health` - Comprehensive health check with detailed information
- `GET /api/health/live` - Basic liveness check
- `GET /api/health/ready` - Readiness check with dependency validation
- `GET /api/health/metrics` - Application performance metrics
- `GET /api/health/database` - Database-specific health information
- `GET /api/health/redis` - Redis-specific health information
- `GET /api/health/system` - System resource health information
- `GET /api/health/sse` - SSE service health information
- `GET /api/health/sessions` - Session management health information
- `GET /api/health/cache` - Cache service health information
- `GET /api/health/performance` - Comprehensive performance metrics
- `GET /api/health/alerts` - Current alerts and alerting statistics

### Monitoring Dashboard Endpoints

- `GET /api/health/dashboard` - Real-time monitoring dashboard data
- `GET /api/health/dashboard/config` - Dashboard configuration for monitoring tools
- `GET /api/health/dashboard/errors` - Error pattern analysis and log aggregation
- `GET /api/health/dashboard/stats` - Monitoring service statistics

### Monitoring Configuration Endpoints

- `GET /api/health/config/grafana` - Grafana dashboard configuration
- `GET /api/health/config/prometheus` - Prometheus alerting rules
- `GET /api/health/config/logs` - Log aggregation patterns
- `GET /api/health/config/integrations` - Monitoring tool integrations
- `GET /api/health/config/setup` - Monitoring setup guide
- `GET /api/health/config/best-practices` - Monitoring best practices

## Quick Setup

### 1. Enable Spring Boot Actuator (Already Configured)

The application already includes comprehensive Spring Boot Actuator configuration:

```properties
# Enhanced Actuator Configuration
management.endpoints.web.exposure.include=health,info,metrics,prometheus,httptrace,threaddump,heapdump,env,configprops,beans,mappings,scheduledtasks,caches,conditions,flyway,liquibase,sessions,shutdown
management.endpoint.health.show-details=when-authorized
management.endpoint.health.show-components=always
management.endpoint.health.probes.enabled=true

# Metrics Configuration
management.metrics.enabled=true
management.metrics.export.prometheus.enabled=true
management.metrics.distribution.percentiles-histogram.http.server.requests=true
```

### 2. Set Up Prometheus

Create a `prometheus.yml` configuration file:

```yaml
global:
  scrape_interval: 30s

scrape_configs:
  - job_name: 'shopgauge-backend'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/actuator/prometheus'
    scrape_interval: 30s
```

Run Prometheus:

```bash
docker run -d -p 9090:9090 -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus
```

### 3. Set Up Grafana

Run Grafana:

```bash
docker run -d -p 3000:3000 grafana/grafana
```

Import dashboard configuration:

1. Access Grafana at http://localhost:3000 (admin/admin)
2. Add Prometheus data source: http://localhost:9090
3. Get dashboard configuration from: `GET /api/health/config/grafana`
4. Import the dashboard JSON configuration

### 4. Configure Alerting

Get Prometheus alerting rules:

```bash
curl http://localhost:8080/api/health/config/prometheus > alerting-rules.yml
```

Add to your Prometheus configuration:

```yaml
rule_files:
  - "alerting-rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

## Detailed Setup Instructions

### Prometheus Setup

1. **Download and Configure Prometheus**

```bash
# Download Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.40.0/prometheus-2.40.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*

# Get configuration from the application
curl http://localhost:8080/api/health/config/prometheus > prometheus-rules.yml
```

2. **Create Prometheus Configuration**

```yaml
# prometheus.yml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

rule_files:
  - "prometheus-rules.yml"

scrape_configs:
  - job_name: 'shopgauge-backend'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/actuator/prometheus'
    scrape_interval: 30s
    metrics_path: '/actuator/prometheus'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - localhost:9093
```

3. **Start Prometheus**

```bash
./prometheus --config.file=prometheus.yml
```

### Grafana Setup

1. **Install and Start Grafana**

```bash
# Using Docker
docker run -d -p 3000:3000 --name grafana grafana/grafana

# Or using package manager (Ubuntu/Debian)
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
sudo apt-get update
sudo apt-get install grafana
sudo systemctl start grafana-server
```

2. **Configure Data Source**

- Access Grafana at http://localhost:3000
- Login with admin/admin
- Add Prometheus data source: http://localhost:9090

3. **Import Dashboard**

```bash
# Get dashboard configuration
curl http://localhost:8080/api/health/config/grafana > shopgauge-dashboard.json

# Import via Grafana UI or API
curl -X POST \
  http://admin:admin@localhost:3000/api/dashboards/db \
  -H 'Content-Type: application/json' \
  -d @shopgauge-dashboard.json
```

### Alertmanager Setup

1. **Install Alertmanager**

```bash
wget https://github.com/prometheus/alertmanager/releases/download/v0.25.0/alertmanager-0.25.0.linux-amd64.tar.gz
tar xvfz alertmanager-*.tar.gz
cd alertmanager-*
```

2. **Configure Alertmanager**

```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@shopgauge.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  email_configs:
  - to: 'admin@shopgauge.com'
    subject: 'ShopGauge Alert: {{ .GroupLabels.alertname }}'
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      {{ end }}
```

3. **Start Alertmanager**

```bash
./alertmanager --config.file=alertmanager.yml
```

## Log Aggregation Setup

### ELK Stack (Elasticsearch, Logstash, Kibana)

1. **Get Log Patterns**

```bash
curl http://localhost:8080/api/health/config/logs > log-patterns.json
```

2. **Configure Logstash**

```ruby
# logstash.conf
input {
  file {
    path => "/path/to/shopgauge/logs/*.log"
    start_position => "beginning"
  }
}

filter {
  if [message] =~ /ERROR|WARN|CRITICAL/ {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{JAVACLASS:logger} - %{GREEDYDATA:message}" }
    }
    
    if [message] =~ /SessionSynchronizationService/ {
      mutate { add_tag => ["session_error"] }
    }
    
    if [message] =~ /SseService.*connection/ {
      mutate { add_tag => ["sse_error"] }
    }
    
    if [message] =~ /DatabaseMonitoringService/ {
      mutate { add_tag => ["database_error"] }
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "shopgauge-logs-%{+YYYY.MM.dd}"
  }
}
```

### Splunk Setup

1. **Configure Splunk Universal Forwarder**

```bash
# Install Splunk Universal Forwarder
# Configure inputs.conf
[monitor:///path/to/shopgauge/logs]
disabled = false
index = shopgauge
sourcetype = shopgauge_backend
```

2. **Create Splunk Searches**

```splunk
# Error monitoring search
index=shopgauge source=*backend* ERROR

# High memory usage alerts
index=shopgauge source=*backend* "High memory usage"

# Connection pool monitoring
index=shopgauge source=*backend* "connection pool"

# Session lock failures
index=shopgauge source=*backend* "session lock failure"

# SSE connection errors
index=shopgauge source=*backend* "SSE connection error"
```

## Monitoring Best Practices

### Metrics

- **Use consistent naming conventions**: Follow Prometheus naming conventions
- **Include relevant labels**: Add labels for filtering and grouping
- **Monitor both technical and business metrics**: Include user-facing metrics
- **Set appropriate retention policies**: Balance storage costs with data needs

### Alerting

- **Define clear severity levels**: Use INFO, WARNING, CRITICAL consistently
- **Avoid alert fatigue**: Set appropriate thresholds to prevent noise
- **Include actionable information**: Alerts should tell you what to do
- **Test alerting rules regularly**: Ensure alerts fire when expected

### Dashboards

- **Create role-specific dashboards**: Different views for different teams
- **Use consistent color schemes**: Red for critical, yellow for warning, green for healthy
- **Include context and documentation**: Add descriptions and links
- **Regular review and updates**: Keep dashboards current and relevant

### Logging

- **Use structured logging**: JSON format for better parsing
- **Include correlation IDs**: For request tracing across services
- **Log at appropriate levels**: Don't over-log or under-log
- **Implement log rotation**: Prevent disk space issues

## Troubleshooting

### Common Issues

1. **Metrics not appearing in Prometheus**
   - Check if `/actuator/prometheus` endpoint is accessible
   - Verify Prometheus scrape configuration
   - Check application logs for errors

2. **Grafana dashboard not loading data**
   - Verify Prometheus data source configuration
   - Check metric names in dashboard queries
   - Ensure time range is appropriate

3. **Alerts not firing**
   - Verify alerting rules syntax
   - Check Prometheus rules evaluation
   - Ensure Alertmanager is configured correctly

4. **High resource usage**
   - Check monitoring intervals and retention
   - Optimize metric collection frequency
   - Review dashboard query efficiency

### Getting Help

- Check application logs: `/api/health/dashboard/errors`
- Review monitoring statistics: `/api/health/dashboard/stats`
- Verify service health: `/api/health`
- Check alert status: `/api/health/alerts`

## Advanced Configuration

### Custom Metrics

The application provides extensive custom metrics through the MetricsCollectionService:

- Session operations and synchronization metrics
- SSE connection and event metrics
- Cache performance and hit rate metrics
- Database operation and performance metrics
- System health and resource usage metrics

### Integration with External Tools

The application provides configuration for various monitoring tools:

- **New Relic**: APM and infrastructure monitoring
- **Datadog**: Application performance monitoring
- **AWS CloudWatch**: Cloud-native monitoring
- **Azure Monitor**: Microsoft cloud monitoring

Get integration configurations from: `/api/health/config/integrations`

### Custom Alerting Rules

You can extend the alerting rules by:

1. Getting the base configuration: `GET /api/health/config/prometheus`
2. Adding your custom rules to the YAML
3. Reloading Prometheus configuration

### Dashboard Customization

Customize dashboards by:

1. Getting the base configuration: `GET /api/health/config/grafana`
2. Modifying panels, queries, and layouts
3. Importing the modified configuration

## Conclusion

This monitoring setup provides comprehensive observability for the ShopGauge application, including:

- Real-time metrics and alerting
- Performance monitoring and optimization
- Error tracking and analysis
- Resource usage monitoring
- Business metrics tracking

Regular monitoring and maintenance of these systems will ensure optimal application performance and reliability.