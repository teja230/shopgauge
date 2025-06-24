package com.storesight.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.model.Notification;
import com.storesight.backend.repository.NotificationRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;

@Service
public class NotificationService {
  private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

  private final StringRedisTemplate stringRedisTemplate;
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final WebClient webClient;
  private final NotificationRepository notificationRepository;
  private final SecretService secretService;

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

  @Autowired
  public NotificationService(
      StringRedisTemplate stringRedisTemplate,
      NotificationRepository notificationRepository,
      SecretService secretService,
      WebClient.Builder webClientBuilder) {
    this.stringRedisTemplate = stringRedisTemplate;
    this.notificationRepository = notificationRepository;
    this.secretService = secretService;
    this.webClient = webClientBuilder.build();
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
        "Notification service initialized - SendGrid enabled: {}, Twilio enabled: {}, SendGrid key: {}, Twilio SID: {}",
        sendGridEnabled,
        twilioEnabled,
        sendGridApiKey != null
            ? sendGridApiKey.substring(0, Math.min(8, sendGridApiKey.length())) + "..."
            : "null",
        twilioAccountSid != null
            ? twilioAccountSid.substring(0, Math.min(8, twilioAccountSid.length())) + "..."
            : "null");
  }

  public void sendEmailAlert(String to, String subject, String body) {
    if (!sendGridEnabled) {
      log.warn("SendGrid is not enabled - skipping email alert to: {}", to);
      return;
    }

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
                + "\"from\":{\"email\":\"noreply@storesight.app\"},"
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
    webClient
        .post()
        .uri("https://api.twilio.com/2010-04-01/Accounts/" + twilioAccountSid + "/Messages.json")
        .headers(
            headers -> {
              headers.setBasicAuth(twilioAccountSid, twilioAuthToken);
              headers.setContentType(
                  org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED);
            })
        .bodyValue(
            "To="
                + phoneNumber
                + "&From="
                + twilioFromNumber
                + "&Body="
                + java.net.URLEncoder.encode(message, java.nio.charset.StandardCharsets.UTF_8))
        .retrieve()
        .bodyToMono(String.class)
        .subscribe(
            response -> log.info("SMS alert sent successfully to: {}", phoneNumber),
            error ->
                log.error("Failed to send SMS alert to {}: {}", phoneNumber, error.getMessage()));
  }

  public Mono<List<Notification>> getNotifications(String shop) {
    return Mono.just(notificationRepository.findByShopOrderByCreatedAtDesc(shop));
  }

  public Mono<Void> markAsRead(String shop, String notificationId) {
    return Mono.fromRunnable(
        () -> {
          notificationRepository
              .findById(notificationId)
              .ifPresent(
                  notification -> {
                    notification.setRead(true);
                    notificationRepository.save(notification);
                  });
        });
  }

  public Mono<List<Notification>> getNotifications(String shop, String sessionId) {
    return getNotifications(shop); // ignore sessionId for now
  }

  public Mono<Void> markAsRead(String shop, String notificationId, String sessionId) {
    return markAsRead(shop, notificationId); // ignore sessionId for now
  }

  public boolean isSendGridEnabled() {
    return sendGridEnabled;
  }

  public boolean isTwilioEnabled() {
    return twilioEnabled;
  }
}
