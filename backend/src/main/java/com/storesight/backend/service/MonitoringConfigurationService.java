package com.storesight.backend.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Monitoring configuration service for external monitoring tools
 *
 * <p>This service provides: - Grafana dashboard configurations - Prometheus alerting rules - Log
 * aggregation patterns - Monitoring tool integrations
 */
@Service
public class MonitoringConfigurationService {

  private static final Logger logger =
      LoggerFactory.getLogger(MonitoringConfigurationService.class);

  /** Get Grafana dashboard configuration for system monitoring */
  public Map<String, Object> getGrafanaDashboardConfig() {
    Map<String, Object> dashboard = new HashMap<>();

    // Dashboard metadata
    dashboard.put("id", null);
    dashboard.put("title", "ShopGauge System Monitoring");
    dashboard.put("tags", List.of("shopgauge", "monitoring", "system"));
    dashboard.put("timezone", "browser");
    dashboard.put("refresh", "30s");
    dashboard.put(
        "time",
        Map.of(
            "from", "now-1h",
            "to", "now"));

    // Dashboard panels
    List<Map<String, Object>> panels = new ArrayList<>();

    // System Resources Panel
    panels.add(
        createGrafanaPanel(
            1,
            "System Resources",
            "graph",
            0,
            0,
            12,
            8,
            List.of(
                Map.of("expr", "system_memory_usage", "legendFormat", "Memory Usage %"),
                Map.of("expr", "system_cpu_usage", "legendFormat", "CPU Usage %"),
                Map.of("expr", "system_disk_usage", "legendFormat", "Disk Usage %"))));

    // Session Management Panel
    panels.add(
        createGrafanaPanel(
            2,
            "Session Management",
            "graph",
            12,
            0,
            12,
            8,
            List.of(
                Map.of(
                    "expr", "session_lock_acquisitions_total", "legendFormat", "Lock Acquisitions"),
                Map.of("expr", "session_lock_failures_total", "legendFormat", "Lock Failures"),
                Map.of(
                    "expr",
                    "session_stuck_cleared_total",
                    "legendFormat",
                    "Stuck Sessions Cleared"))));

    // SSE Performance Panel
    panels.add(
        createGrafanaPanel(
            3,
            "SSE Performance",
            "graph",
            0,
            8,
            12,
            8,
            List.of(
                Map.of("expr", "sse_connections_active", "legendFormat", "Active Connections"),
                Map.of("expr", "sse_events_published_total", "legendFormat", "Events Published"),
                Map.of(
                    "expr", "sse_connection_errors_total", "legendFormat", "Connection Errors"))));

    // Database Performance Panel
    panels.add(
        createGrafanaPanel(
            4,
            "Database Performance",
            "graph",
            12,
            8,
            12,
            8,
            List.of(
                Map.of("expr", "database_queries_total", "legendFormat", "Total Queries"),
                Map.of("expr", "database_errors_total", "legendFormat", "Database Errors"),
                Map.of(
                    "expr", "database_query_duration_seconds", "legendFormat", "Query Duration"))));

    // Cache Performance Panel
    panels.add(
        createGrafanaPanel(
            5,
            "Cache Performance",
            "graph",
            0,
            16,
            12,
            8,
            List.of(
                Map.of("expr", "cache_hits_total", "legendFormat", "Cache Hits"),
                Map.of("expr", "cache_misses_total", "legendFormat", "Cache Misses"),
                Map.of("expr", "cache_size_current", "legendFormat", "Cache Size"))));

    // Alert Summary Panel
    panels.add(
        createGrafanaPanel(
            6,
            "Active Alerts",
            "stat",
            12,
            16,
            12,
            8,
            List.of(
                Map.of("expr", "alerts_active_critical", "legendFormat", "Critical Alerts"),
                Map.of("expr", "alerts_active_warning", "legendFormat", "Warning Alerts"))));

    dashboard.put("panels", panels);

    return dashboard;
  }

  /** Create a Grafana panel configuration */
  private Map<String, Object> createGrafanaPanel(
      int id,
      String title,
      String type,
      int x,
      int y,
      int w,
      int h,
      List<Map<String, String>> targets) {

    Map<String, Object> panel = new HashMap<>();
    panel.put("id", id);
    panel.put("title", title);
    panel.put("type", type);
    panel.put("gridPos", Map.of("x", x, "y", y, "w", w, "h", h));

    // Panel targets (queries)
    List<Map<String, Object>> panelTargets = new ArrayList<>();
    for (int i = 0; i < targets.size(); i++) {
      Map<String, String> target = targets.get(i);
      Map<String, Object> panelTarget = new HashMap<>();
      panelTarget.put("expr", target.get("expr"));
      panelTarget.put("legendFormat", target.get("legendFormat"));
      panelTarget.put("refId", String.valueOf((char) ('A' + i)));
      panelTargets.add(panelTarget);
    }
    panel.put("targets", panelTargets);

    // Panel options based on type
    if ("graph".equals(type)) {
      panel.put("yAxes", List.of(Map.of("label", "Value", "show", true), Map.of("show", false)));
      panel.put("xAxis", Map.of("show", true));
      panel.put(
          "legend",
          Map.of(
              "show", true, "values", false, "min", false, "max", false, "current", false, "total",
              false, "avg", false));
    } else if ("stat".equals(type)) {
      panel.put(
          "options",
          Map.of(
              "reduceOptions", Map.of("values", false, "calcs", List.of("lastNotNull")),
              "orientation", "auto",
              "textMode", "auto",
              "colorMode", "value"));
    }

    return panel;
  }

  /** Get Prometheus alerting rules configuration */
  public Map<String, Object> getPrometheusAlertingRules() {
    Map<String, Object> config = new HashMap<>();

    List<Map<String, Object>> groups = new ArrayList<>();

    // System alerts group
    Map<String, Object> systemGroup = new HashMap<>();
    systemGroup.put("name", "shopgauge.system");
    systemGroup.put(
        "rules",
        List.of(
            createPrometheusAlert(
                "HighMemoryUsage",
                "system_memory_usage > 80",
                "5m",
                "warning",
                "High memory usage detected",
                "Memory usage is above 80% for more than 5 minutes"),
            createPrometheusAlert(
                "CriticalMemoryUsage",
                "system_memory_usage > 95",
                "2m",
                "critical",
                "Critical memory usage detected",
                "Memory usage is above 95% for more than 2 minutes"),
            createPrometheusAlert(
                "HighCpuUsage",
                "system_cpu_usage > 80",
                "5m",
                "warning",
                "High CPU usage detected",
                "CPU usage is above 80% for more than 5 minutes"),
            createPrometheusAlert(
                "HighDiskUsage",
                "system_disk_usage > 80",
                "10m",
                "warning",
                "High disk usage detected",
                "Disk usage is above 80% for more than 10 minutes")));
    groups.add(systemGroup);

    // Database alerts group
    Map<String, Object> databaseGroup = new HashMap<>();
    databaseGroup.put("name", "shopgauge.database");
    databaseGroup.put(
        "rules",
        List.of(
            createPrometheusAlert(
                "HighDatabaseErrorRate",
                "rate(database_errors_total[5m]) / rate(database_queries_total[5m]) > 0.05",
                "2m",
                "warning",
                "High database error rate",
                "Database error rate is above 5% for more than 2 minutes"),
            createPrometheusAlert(
                "ConnectionPoolExhaustion",
                "database_connection_pool_exhaustion_total > 0",
                "1m",
                "critical",
                "Database connection pool exhaustion",
                "Database connection pool is exhausted"),
            createPrometheusAlert(
                "HighConnectionPoolUtilization",
                "database_connection_pool_utilization > 90",
                "5m",
                "warning",
                "High connection pool utilization",
                "Database connection pool utilization is above 90%")));
    groups.add(databaseGroup);

    // Session management alerts group
    Map<String, Object> sessionGroup = new HashMap<>();
    sessionGroup.put("name", "shopgauge.sessions");
    sessionGroup.put(
        "rules",
        List.of(
            createPrometheusAlert(
                "StuckSessionsDetected",
                "session_stuck_cleared_total > 0",
                "1m",
                "warning",
                "Stuck sessions detected",
                "Stuck sessions have been detected and cleared"),
            createPrometheusAlert(
                "HighSessionLockFailureRate",
                "rate(session_lock_failures_total[5m]) / rate(session_lock_acquisitions_total[5m]) > 0.15",
                "3m",
                "warning",
                "High session lock failure rate",
                "Session lock failure rate is above 15%")));
    groups.add(sessionGroup);

    // SSE alerts group
    Map<String, Object> sseGroup = new HashMap<>();
    sseGroup.put("name", "shopgauge.sse");
    sseGroup.put(
        "rules",
        List.of(
            createPrometheusAlert(
                "HighSseErrorRate",
                "rate(sse_connection_errors_total[5m]) / rate(sse_connections_created_total[5m]) > 0.10",
                "3m",
                "warning",
                "High SSE error rate",
                "SSE connection error rate is above 10%"),
            createPrometheusAlert(
                "HighSseConnectionUtilization",
                "sse_connections_active / 50 > 0.90",
                "5m",
                "warning",
                "High SSE connection utilization",
                "SSE connection utilization is above 90%")));
    groups.add(sseGroup);

    // Cache alerts group
    Map<String, Object> cacheGroup = new HashMap<>();
    cacheGroup.put("name", "shopgauge.cache");
    cacheGroup.put(
        "rules",
        List.of(
            createPrometheusAlert(
                "LowCacheHitRate",
                "cache_hits_total / (cache_hits_total + cache_misses_total) < 0.50",
                "10m",
                "warning",
                "Low cache hit rate",
                "Cache hit rate is below 50% for more than 10 minutes"),
            createPrometheusAlert(
                "HighCacheEvictionRate",
                "rate(cache_evictions_total[5m]) > 10",
                "5m",
                "warning",
                "High cache eviction rate",
                "Cache eviction rate is high")));
    groups.add(cacheGroup);

    config.put("groups", groups);
    return config;
  }

  /** Create a Prometheus alert rule */
  private Map<String, Object> createPrometheusAlert(
      String alert,
      String expr,
      String forDuration,
      String severity,
      String summary,
      String description) {

    Map<String, Object> rule = new HashMap<>();
    rule.put("alert", alert);
    rule.put("expr", expr);
    rule.put("for", forDuration);

    Map<String, String> labels = new HashMap<>();
    labels.put("severity", severity);
    labels.put("service", "shopgauge");
    rule.put("labels", labels);

    Map<String, String> annotations = new HashMap<>();
    annotations.put("summary", summary);
    annotations.put("description", description);
    rule.put("annotations", annotations);

    return rule;
  }

  /** Get log aggregation patterns for common monitoring tools */
  public Map<String, Object> getLogAggregationPatterns() {
    Map<String, Object> patterns = new HashMap<>();

    // ELK Stack (Elasticsearch, Logstash, Kibana) patterns
    Map<String, Object> elkPatterns = new HashMap<>();
    elkPatterns.put(
        "error_patterns",
        List.of(
            "ERROR.*SessionSynchronizationService.*",
            "ERROR.*SseService.*connection.*",
            "ERROR.*DatabaseMonitoringService.*",
            "WARN.*High.*usage.*",
            "CRITICAL.*memory.*",
            "CRITICAL.*CPU.*",
            "CRITICAL.*disk.*"));
    elkPatterns.put(
        "performance_patterns",
        List.of(".*took.*ms.*", ".*duration.*seconds.*", ".*response.*time.*", ".*slow.*query.*"));
    elkPatterns.put(
        "security_patterns",
        List.of(
            ".*authentication.*failed.*", ".*unauthorized.*access.*", ".*security.*violation.*"));
    patterns.put("elk", elkPatterns);

    // Splunk patterns
    Map<String, Object> splunkPatterns = new HashMap<>();
    splunkPatterns.put(
        "search_queries",
        List.of(
            "index=shopgauge source=*backend* ERROR",
            "index=shopgauge source=*backend* \"High memory usage\"",
            "index=shopgauge source=*backend* \"connection pool\"",
            "index=shopgauge source=*backend* \"session lock failure\"",
            "index=shopgauge source=*backend* \"SSE connection error\""));
    patterns.put("splunk", splunkPatterns);

    // Fluentd patterns
    Map<String, Object> fluentdPatterns = new HashMap<>();
    fluentdPatterns.put(
        "filters",
        List.of(
            Map.of("type", "grep", "regexp1", "message", "pattern", "ERROR|WARN|CRITICAL"),
            Map.of(
                "type",
                "parser",
                "key_name",
                "message",
                "format",
                "regexp",
                "expression",
                "^(?<timestamp>\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}.\\d{3}) (?<level>\\w+) (?<logger>\\S+) - (?<message>.*)$")));
    patterns.put("fluentd", fluentdPatterns);

    return patterns;
  }

  /** Get monitoring tool integration configurations */
  public Map<String, Object> getMonitoringIntegrations() {
    Map<String, Object> integrations = new HashMap<>();

    // Prometheus integration
    Map<String, Object> prometheus = new HashMap<>();
    prometheus.put(
        "scrape_configs",
        List.of(
            Map.of(
                "job_name", "shopgauge-backend",
                "static_configs", List.of(Map.of("targets", List.of("localhost:8080"))),
                "metrics_path", "/actuator/prometheus",
                "scrape_interval", "30s")));
    integrations.put("prometheus", prometheus);

    // Grafana integration
    Map<String, Object> grafana = new HashMap<>();
    grafana.put(
        "datasources",
        List.of(
            Map.of(
                "name", "Prometheus",
                "type", "prometheus",
                "url", "http://localhost:9090",
                "access", "proxy",
                "isDefault", true)));
    integrations.put("grafana", grafana);

    // New Relic integration
    Map<String, Object> newRelic = new HashMap<>();
    newRelic.put(
        "application_monitoring",
        Map.of(
            "app_name", "ShopGauge Backend",
            "license_key", "${NEW_RELIC_LICENSE_KEY}",
            "log_level", "info"));
    integrations.put("newrelic", newRelic);

    // Datadog integration
    Map<String, Object> datadog = new HashMap<>();
    datadog.put(
        "apm",
        Map.of(
            "enabled", true,
            "service_name", "shopgauge-backend",
            "env", "${ENVIRONMENT}"));
    integrations.put("datadog", datadog);

    return integrations;
  }

  /** Get comprehensive monitoring setup guide */
  public Map<String, Object> getMonitoringSetupGuide() {
    Map<String, Object> guide = new HashMap<>();

    // Prerequisites
    guide.put(
        "prerequisites",
        List.of(
            "Spring Boot Actuator enabled",
            "Micrometer metrics configured",
            "Prometheus endpoint exposed",
            "Health check endpoints available"));

    // Setup steps
    List<Map<String, Object>> steps = new ArrayList<>();

    steps.add(
        Map.of(
            "step",
            1,
            "title",
            "Configure Prometheus",
            "description",
            "Set up Prometheus to scrape metrics from the application",
            "commands",
            List.of(
                "docker run -d -p 9090:9090 -v prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus")));

    steps.add(
        Map.of(
            "step",
            2,
            "title",
            "Configure Grafana",
            "description",
            "Set up Grafana dashboards for visualization",
            "commands",
            List.of(
                "docker run -d -p 3000:3000 grafana/grafana",
                "Import dashboard configuration from /api/health/dashboard/config")));

    steps.add(
        Map.of(
            "step",
            3,
            "title",
            "Configure Alerting",
            "description",
            "Set up alerting rules and notification channels",
            "commands",
            List.of(
                "Configure Prometheus alerting rules from /api/health/alerts/config",
                "Set up notification channels (email, Slack, PagerDuty)")));

    steps.add(
        Map.of(
            "step",
            4,
            "title",
            "Configure Log Aggregation",
            "description",
            "Set up log aggregation and analysis",
            "commands",
            List.of(
                "Configure log patterns from /api/health/dashboard/errors",
                "Set up log forwarding to centralized logging system")));

    guide.put("setup_steps", steps);

    // Verification
    guide.put(
        "verification",
        List.of(
            "Check Prometheus targets at http://localhost:9090/targets",
            "Verify Grafana dashboards at http://localhost:3000",
            "Test alerting rules with simulated conditions",
            "Verify log aggregation is working"));

    guide.put("timestamp", LocalDateTime.now());
    return guide;
  }

  /** Get monitoring best practices */
  public Map<String, Object> getMonitoringBestPractices() {
    Map<String, Object> practices = new HashMap<>();

    practices.put(
        "metrics",
        List.of(
            "Use consistent naming conventions for metrics",
            "Include relevant labels for filtering and grouping",
            "Monitor both technical and business metrics",
            "Set appropriate retention policies"));

    practices.put(
        "alerting",
        List.of(
            "Define clear severity levels (info, warning, critical)",
            "Avoid alert fatigue with proper thresholds",
            "Include actionable information in alerts",
            "Test alerting rules regularly"));

    practices.put(
        "dashboards",
        List.of(
            "Create role-specific dashboards",
            "Use consistent color schemes and layouts",
            "Include context and documentation",
            "Regular review and updates"));

    practices.put(
        "logging",
        List.of(
            "Use structured logging (JSON format)",
            "Include correlation IDs for request tracing",
            "Log at appropriate levels",
            "Implement log rotation and retention"));

    return practices;
  }
}
