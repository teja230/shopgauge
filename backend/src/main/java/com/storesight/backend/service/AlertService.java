package com.storesight.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.config.BackendConfig;
import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

@Service
@Profile("worker")
public class AlertService {
  private static final Logger log = LoggerFactory.getLogger(AlertService.class);
  private final RedisTemplate<String, Object> redisTemplate;
  private final StringRedisTemplate stringRedisTemplate;
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final SecretService secretService;
  private final WebClient webClient;
  private final BackendConfig backendConfig;
  private final JdbcTemplate jdbcTemplate;

  @Value("${sendgrid.api_key:}")
  private String sendGridApiKey;

  @Value("${twilio.account_sid:}")
  private String twilioAccountSid;

  @Value("${twilio.auth_token:}")
  private String twilioAuthToken;

  @Value("${twilio.from_number:+1234567890}")
  private String twilioFromNumber;

  private boolean sendGridEnabled = false;
  private boolean twilioEnabled = false;

  public AlertService(
      RedisTemplate<String, Object> redisTemplate,
      StringRedisTemplate stringRedisTemplate,
      SecretService secretService,
      WebClient.Builder webClientBuilder,
      BackendConfig backendConfig,
      JdbcTemplate jdbcTemplate) {
    this.redisTemplate = redisTemplate;
    this.stringRedisTemplate = stringRedisTemplate;
    this.secretService = secretService;
    this.webClient = webClientBuilder.build();
    this.backendConfig = backendConfig;
    this.jdbcTemplate = jdbcTemplate;
  }

  @PostConstruct
  public void initializeSecrets() {
    // Fallback to Redis-stored secrets if env vars are not provided
    if (sendGridApiKey == null
        || sendGridApiKey.isBlank()
        || sendGridApiKey.equals("YOUR_SENDGRID_API_KEY")) {
      secretService
          .getSecret("sendgrid.api.key")
          .ifPresent(
              val -> {
                this.sendGridApiKey = val;
                log.info("Loaded SendGrid API key from Redis secret store");
              });
    }

    if (twilioAccountSid == null
        || twilioAccountSid.isBlank()
        || twilioAccountSid.equals("YOUR_TWILIO_SID")) {
      secretService
          .getSecret("twilio.account.sid")
          .ifPresent(
              val -> {
                this.twilioAccountSid = val;
                log.info("Loaded Twilio Account SID from Redis secret store");
              });
    }

    if (twilioAuthToken == null
        || twilioAuthToken.isBlank()
        || twilioAuthToken.equals("YOUR_TWILIO_AUTH_TOKEN")) {
      secretService
          .getSecret("twilio.auth.token")
          .ifPresent(
              val -> {
                this.twilioAuthToken = val;
                log.info("Loaded Twilio Auth Token from Redis secret store");
              });
    }

    // Check if services are enabled
    this.sendGridEnabled =
        sendGridApiKey != null
            && !sendGridApiKey.trim().isEmpty()
            && !sendGridApiKey.equals("YOUR_SENDGRID_API_KEY");
    this.twilioEnabled =
        twilioAccountSid != null
            && !twilioAccountSid.trim().isEmpty()
            && twilioAuthToken != null
            && !twilioAuthToken.trim().isEmpty()
            && !twilioAccountSid.equals("YOUR_TWILIO_SID")
            && !twilioAuthToken.equals("YOUR_TWILIO_AUTH_TOKEN");

    // Log final state
    log.info(
        "Alert service initialized - SendGrid enabled: {}, Twilio enabled: {}, SendGrid key: {}, Twilio SID: {}",
        sendGridEnabled,
        twilioEnabled,
        sendGridApiKey != null
            ? sendGridApiKey.substring(0, Math.min(8, sendGridApiKey.length())) + "..."
            : "null",
        twilioAccountSid != null
            ? twilioAccountSid.substring(0, Math.min(8, twilioAccountSid.length())) + "..."
            : "null");
  }

  @Scheduled(fixedDelay = 10000)
  public void pollAlerts() {
    List<Map<String, Object>> pendingAlerts =
        jdbcTemplate.queryForList(
            """
            SELECT pa.id, pa.alert_type, pa.old_price, pa.new_price, pa.change_percent,
                   s.shopify_domain, COALESCE(cu.label, cu.url, 'competitor') AS competitor
            FROM price_alerts pa
            JOIN shops s ON s.id = pa.shop_id
            LEFT JOIN competitor_urls cu ON cu.id = pa.competitor_url_id
            WHERE pa.notification_sent = false
            ORDER BY pa.created_at
            LIMIT 100
            """);

    for (Map<String, Object> alert : pendingAlerts) {
      Long alertId = ((Number) alert.get("id")).longValue();
      String shop = String.valueOf(alert.get("shopify_domain"));
      String type = String.valueOf(alert.get("alert_type"));
      String competitor = String.valueOf(alert.get("competitor"));
      String message = formatPriceAlertMessage(alert, competitor, type);
      try {
        triggerBusinessEvent(shop, "Competitor " + humanizeAlertType(type), message);
        jdbcTemplate.update(
            "UPDATE price_alerts SET notification_sent = true WHERE id = ?", alertId);
      } catch (Exception e) {
        log.error("Failed to dispatch price alert {}: {}", alertId, e.getMessage(), e);
      }
    }
  }

  static String formatPriceAlertMessage(
      Map<String, Object> alert, String competitor, String alertType) {
    Object oldPrice = alert.get("old_price");
    Object newPrice = alert.get("new_price");
    Object changePercent = alert.get("change_percent");
    if ("back_in_stock".equals(alertType)) {
      return competitor + " is back in stock.";
    }
    if ("out_of_stock".equals(alertType)) {
      return competitor + " is out of stock.";
    }
    return String.format(
        "%s price changed from %s to %s (%s%%).", competitor, oldPrice, newPrice, changePercent);
  }

  private static String humanizeAlertType(String alertType) {
    return alertType.replace('_', ' ');
  }

  public void sendEmailAlert(String to, String subject, String body) {
    if (!sendGridEnabled) {
      log.warn("SendGrid is not enabled - skipping email alert to: {}", to);
      return;
    }

    // SendGrid API call
    webClient
        .post()
        .uri("https://api.sendgrid.com/v3/mail/send")
        .header("Authorization", "Bearer " + sendGridApiKey)
        .header("Content-Type", "application/json")
        .bodyValue(
            "{"
                + "\"personalizations\":[{\"to\":[{\"email\":\""
                + to
                + "\"}]}],"
                + "\"from\":{\"email\":\"noreply@shopgaugeai.com\"},"
                + "\"subject\":\""
                + subject
                + "\","
                + "\"content\":[{\"type\":\"text/plain\",\"value\":\""
                + body
                + "\"}]}")
        .retrieve()
        .bodyToMono(String.class)
        .subscribe(
            response -> log.info("Email alert sent successfully to: {}", to),
            error -> log.error("Failed to send email alert to {}: {}", to, error.getMessage()));
  }

  public void sendSlackAlert(String webhookUrl, String message) {
    if (webhookUrl == null || webhookUrl.isEmpty()) return;
    webClient
        .post()
        .uri(webhookUrl)
        .header("Content-Type", "application/json")
        .bodyValue("{\"text\":\"" + message + "\"}")
        .retrieve()
        .bodyToMono(String.class)
        .subscribe(
            response -> log.info("Slack alert sent successfully"),
            error -> log.error("Failed to send Slack alert: {}", error.getMessage()));
  }

  public void sendSmsAlert(String phoneNumber, String message) {
    if (!twilioEnabled) {
      log.warn("Twilio is not enabled - skipping SMS alert to: {}", phoneNumber);
      return;
    }

    if (phoneNumber == null || phoneNumber.isEmpty()) return;
    // Twilio API call
    webClient
        .post()
        .uri("https://api.twilio.com/2010-04-01/Accounts/" + twilioAccountSid + "/Messages.json")
        .headers(
            headers -> {
              headers.setBasicAuth(twilioAccountSid, twilioAuthToken);
              headers.setContentType(
                  org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED);
            })
        .bodyValue("To=" + phoneNumber + "&From=" + twilioFromNumber + "&Body=" + message)
        .retrieve()
        .bodyToMono(String.class)
        .subscribe(
            response -> log.info("SMS alert sent successfully to: {}", phoneNumber),
            error ->
                log.error("Failed to send SMS alert to {}: {}", phoneNumber, error.getMessage()));
  }

  /**
   * Generic alert method that handles different alert types and severities
   *
   * @param subject The alert subject/title
   * @param message The alert message content
   * @param severity The alert severity (INFO, WARNING, ERROR, CRITICAL)
   */
  public void sendAlert(String subject, String message, String severity) {
    log.info("Sending alert - Subject: {}, Severity: {}, Message: {}", subject, severity, message);

    // Format the alert message with severity
    String formattedMessage = String.format("[%s] %s\n\n%s", severity, subject, message);
    String logMessage = String.format("ALERT [%s] %s: %s", severity, subject, message);

    // Always log the alert
    switch (severity.toUpperCase()) {
      case "CRITICAL":
        log.error(logMessage);
        break;
      case "ERROR":
        log.error(logMessage);
        break;
      case "WARNING":
        log.warn(logMessage);
        break;
      case "INFO":
      default:
        log.info(logMessage);
        break;
    }

    // Send email alert for WARNING, ERROR, and CRITICAL
    if (severity.equals("WARNING") || severity.equals("ERROR") || severity.equals("CRITICAL")) {
      sendEmailAlert("admin@shopgaugeai.com", subject, formattedMessage);
    }

    // Send SMS for CRITICAL alerts
    if (severity.equals("CRITICAL")) {
      sendSmsAlert("+18329872361", subject + ": " + message);
    }

    // Store alert in Redis for monitoring dashboard
    try {
      Alert alert = new Alert(subject, message, severity, System.currentTimeMillis());
      redisTemplate.opsForList().leftPush("alerts:recent", alert);
      redisTemplate.expire("alerts:recent", java.time.Duration.ofHours(24));
    } catch (Exception e) {
      log.error("Failed to store alert in Redis: {}", e.getMessage());
    }
  }

  public void triggerBusinessEvent(String shop, String eventType, String message) {
    try {
      String key = "notif_settings:" + shop;
      String json = stringRedisTemplate.opsForValue().get(key);
      if (json != null) {
        var settings = objectMapper.readValue(json, java.util.Map.class);
        if (settings.get("email") != null) {
          sendEmailAlert(
              settings.get("email").toString(), "ShopGauge Alert: " + eventType, message);
        }
        if (settings.get("slack") != null) {
          sendSlackAlert(settings.get("slack").toString(), message);
        }
        if (settings.get("sms") != null) {
          sendSmsAlert(settings.get("sms").toString(), message);
        }
      }
    } catch (Exception e) {
      log.error("Error triggering business event: {}", e.getMessage(), e);
    }
  }

  @Scheduled(cron = "0 0 8 * * *") // Every day at 8am
  public void sendScheduledReports() {
    var keys = stringRedisTemplate.keys("report_schedule:*");
    if (keys == null) return;
    for (String key : keys) {
      String shop = key.substring("report_schedule:".length());
      String schedule = stringRedisTemplate.opsForValue().get(key);
      if (schedule == null || schedule.equals("none")) continue;
      // For demo, send daily; in production, check schedule value
      try {
        // Fetch shop email from notif_settings
        String notifKey = "notif_settings:" + shop;
        String notifJson = stringRedisTemplate.opsForValue().get(notifKey);
        String email = null;
        if (notifJson != null) {
          var settings = objectMapper.readValue(notifJson, java.util.Map.class);
          email = (String) settings.get("email");
        }
        if (email == null) continue;
        // Fetch CSV from export endpoint
        java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
        // Use configuration for backend URL
        String backendUrl = backendConfig.getBackendUrl();
        var req =
            java.net.http.HttpRequest.newBuilder()
                .uri(new java.net.URI(backendUrl + "/api/analytics/export/csv"))
                .header("Cookie", "shop=" + shop)
                .build();
        var resp = client.send(req, java.net.http.HttpResponse.BodyHandlers.ofByteArray());
        byte[] csv = resp.body();
        // Send email with CSV attachment (using SendGrid for now)
        sendEmailWithAttachment(
            email,
            "Your ShopGauge Analytics Report",
            "See attached CSV report.",
            csv,
            "shopgauge-analytics.csv");
      } catch (Exception e) {
        log.error("Error sending scheduled report for shop {}: {}", shop, e.getMessage(), e);
      }
    }
  }

  public void sendEmailWithAttachment(
      String to, String subject, String body, byte[] attachment, String filename) {
    // For demo, just send as plain email with CSV as text
    sendEmailAlert(
        to,
        subject,
        body + "\n\n" + new String(attachment, java.nio.charset.StandardCharsets.UTF_8));
    // For production, use SendGrid or JavaMail to send as real attachment
  }

  public boolean isSendGridEnabled() {
    return sendGridEnabled;
  }

  public boolean isTwilioEnabled() {
    return twilioEnabled;
  }

  /** Alert data class for storing alert information */
  public static class Alert {
    private String subject;
    private String message;
    private String severity;
    private long timestamp;

    public Alert(String subject, String message, String severity, long timestamp) {
      this.subject = subject;
      this.message = message;
      this.severity = severity;
      this.timestamp = timestamp;
    }

    // Getters and setters
    public String getSubject() {
      return subject;
    }

    public void setSubject(String subject) {
      this.subject = subject;
    }

    public String getMessage() {
      return message;
    }

    public void setMessage(String message) {
      this.message = message;
    }

    public String getSeverity() {
      return severity;
    }

    public void setSeverity(String severity) {
      this.severity = severity;
    }

    public long getTimestamp() {
      return timestamp;
    }

    public void setTimestamp(long timestamp) {
      this.timestamp = timestamp;
    }
  }
}
