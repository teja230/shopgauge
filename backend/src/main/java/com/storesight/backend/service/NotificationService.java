package com.storesight.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.model.Notification;
import com.storesight.backend.repository.NotificationRepository;
import jakarta.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

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

  // Notification cleanup policy configuration
  @Value("${notifications.cleanup.enabled:true}")
  private boolean cleanupEnabled;

  @Value("${notifications.cleanup.retention-days:30}")
  private int retentionDays;

  @Value("${notifications.cleanup.batch-size:100}")
  private int cleanupBatchSize;

  @Value("${notifications.cleanup.max-read-notifications:50}")
  private int maxReadNotifications;

  @Value("${notifications.cleanup.max-unread-notifications:100}")
  private int maxUnreadNotifications;

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

  public Mono<List<Notification>> getNotifications(String shop, String sessionId) {
    if (sessionId == null || sessionId.trim().isEmpty()) {
      log.warn(
          "No session ID provided, falling back to shop-wide notifications for shop: {}", shop);
      return getNotifications(shop);
    }

    log.debug("Getting notifications for shop: {} and session: {}", shop, sessionId);
    return Mono.just(
        notificationRepository.findByShopAndSessionOrderByCreatedAtDesc(shop, sessionId));
  }

  public Mono<Void> markAsRead(String shop, String notificationId) {
    return Mono.fromRunnable(
        () -> {
          notificationRepository
              .findById(notificationId)
              .ifPresent(
                  notification -> {
                    // Verify the notification belongs to the shop for security
                    if (notification.getShop().equals(shop)) {
                      notification.setRead(true);
                      notificationRepository.save(notification);
                      log.debug(
                          "Marked notification {} as read for shop: {}", notificationId, shop);
                    } else {
                      log.warn(
                          "Attempted to mark notification {} as read for wrong shop. Expected: {}, Actual: {}",
                          notificationId,
                          shop,
                          notification.getShop());
                    }
                  });
        });
  }

  public Mono<Void> markAsRead(String shop, String notificationId, String sessionId) {
    return Mono.fromRunnable(
        () -> {
          notificationRepository
              .findById(notificationId)
              .ifPresent(
                  notification -> {
                    // Verify the notification belongs to the shop
                    if (!notification.getShop().equals(shop)) {
                      log.warn(
                          "Attempted to mark notification {} as read for wrong shop. Expected: {}, Actual: {}",
                          notificationId,
                          shop,
                          notification.getShop());
                      return;
                    }

                    // Check if notification belongs to this session or is shop-wide
                    if (notification.isShopWide() || notification.belongsToSession(sessionId)) {
                      notification.setRead(true);
                      notificationRepository.save(notification);
                      log.debug(
                          "Marked notification {} as read for shop: {} and session: {}",
                          notificationId,
                          shop,
                          sessionId);
                    } else {
                      log.warn(
                          "Attempted to mark notification {} as read for wrong session. Notification session: {}, Request session: {}",
                          notificationId,
                          notification.getSessionId(),
                          sessionId);
                    }
                  });
        });
  }

  public Mono<Notification> createNotification(
      String shop, String sessionId, String message, String type, String category) {
    return createNotification(shop, sessionId, message, type, category, "personal");
  }

  public Mono<Notification> createNotification(
      String shop, String sessionId, String message, String type, String category, String scope) {
    return Mono.fromCallable(
        () -> {
          Notification notification =
              new Notification(shop, sessionId, message, type, category, scope);
          Notification saved = notificationRepository.save(notification);
          log.debug(
              "Created {} notification for shop: {} and session: {} - {} (scope: {})",
              type,
              shop,
              sessionId,
              message,
              scope);
          return saved;
        });
  }

  public Mono<Notification> createNotification(
      String shop, String message, String type, String category) {
    return createNotification(shop, null, message, type, category);
  }

  public Mono<Long> getUnreadCount(String shop, String sessionId) {
    if (sessionId == null || sessionId.trim().isEmpty()) {
      return Mono.just(0L);
    }
    return Mono.just(notificationRepository.countUnreadByShopAndSession(shop, sessionId));
  }

  public Mono<List<Notification>> getNotificationsByCategory(
      String shop, String sessionId, String category) {
    if (sessionId == null || sessionId.trim().isEmpty()) {
      return Mono.just(List.of());
    }
    return Mono.just(
        notificationRepository.findByShopAndSessionAndCategory(shop, sessionId, category));
  }

  public Mono<Void> cleanupSessionNotifications(String sessionId) {
    return Mono.fromRunnable(
        () -> {
          notificationRepository.deleteBySessionId(sessionId);
          log.info("Cleaned up notifications for session: {}", sessionId);
        });
  }

  public Mono<Void> deleteNotification(String shop, String notificationId, String sessionId) {
    return Mono.fromRunnable(
        () -> {
          notificationRepository
              .findById(notificationId)
              .ifPresent(
                  notification -> {
                    // Verify the notification belongs to the shop
                    if (!notification.getShop().equals(shop)) {
                      log.warn(
                          "Attempted to delete notification {} for wrong shop. Expected: {}, Actual: {}",
                          notificationId,
                          shop,
                          notification.getShop());
                      return;
                    }

                    // Check if notification belongs to this session or is shop-wide
                    if (notification.isShopWide() || notification.belongsToSession(sessionId)) {
                      // Hard delete - permanently remove from database
                      notificationRepository.delete(notification);
                      log.debug(
                          "Hard deleted notification {} for shop: {} and session: {}",
                          notificationId,
                          shop,
                          sessionId);
                    } else {
                      log.warn(
                          "Attempted to delete notification {} for wrong session. Notification session: {}, Request session: {}",
                          notificationId,
                          notification.getSessionId(),
                          sessionId);
                    }
                  });
        });
  }

  /** Soft delete notification for cleanup policy (marks as deleted but keeps in database) */
  public Mono<Void> softDeleteNotification(String shop, String notificationId, String sessionId) {
    return Mono.fromRunnable(
        () -> {
          notificationRepository
              .findById(notificationId)
              .ifPresent(
                  notification -> {
                    // Verify the notification belongs to the shop
                    if (!notification.getShop().equals(shop)) {
                      log.warn(
                          "Attempted to soft delete notification {} for wrong shop. Expected: {}, Actual: {}",
                          notificationId,
                          shop,
                          notification.getShop());
                      return;
                    }

                    // Check if notification belongs to this session or is shop-wide
                    if (notification.isShopWide() || notification.belongsToSession(sessionId)) {
                      // Soft delete - mark as deleted instead of hard delete
                      notification.setDeleted(true);
                      notification.setDeletedAt(LocalDateTime.now());
                      notificationRepository.save(notification);
                      log.debug(
                          "Soft deleted notification {} for shop: {} and session: {}",
                          notificationId,
                          shop,
                          sessionId);
                    } else {
                      log.warn(
                          "Attempted to soft delete notification {} for wrong session. Notification session: {}, Request session: {}",
                          notificationId,
                          notification.getSessionId(),
                          sessionId);
                    }
                  });
        });
  }

  /**
   * Cleanup old notifications based on retention policy This method should be called by a scheduled
   * task
   */
  public Mono<Integer> cleanupOldNotifications() {
    if (!cleanupEnabled) {
      log.debug("Notification cleanup is disabled");
      return Mono.just(0);
    }

    return Mono.fromCallable(
        () -> {
          LocalDateTime cutoffDate = LocalDateTime.now().minusDays(retentionDays);
          int deletedCount = 0;

          // Delete notifications older than retention period
          List<Notification> oldNotifications =
              notificationRepository.findByCreatedAtBefore(cutoffDate);
          if (!oldNotifications.isEmpty()) {
            notificationRepository.deleteAll(oldNotifications);
            deletedCount += oldNotifications.size();
            log.info(
                "Cleaned up {} old notifications (older than {} days)",
                oldNotifications.size(),
                retentionDays);
          }

          // Cleanup read notifications beyond max limit per shop
          List<String> shops = notificationRepository.findDistinctShops();
          for (String shop : shops) {
            List<Notification> readNotifications =
                notificationRepository.findByShopAndReadTrueAndDeletedFalseOrderByCreatedAtDesc(
                    shop);
            if (readNotifications.size() > maxReadNotifications) {
              List<Notification> toDelete =
                  readNotifications.subList(maxReadNotifications, readNotifications.size());
              notificationRepository.deleteAll(toDelete);
              deletedCount += toDelete.size();
              log.info("Cleaned up {} read notifications for shop: {}", toDelete.size(), shop);
            }
          }

          // Cleanup unread notifications beyond max limit per shop
          for (String shop : shops) {
            List<Notification> unreadNotifications =
                notificationRepository.findByShopAndReadFalseAndDeletedFalseOrderByCreatedAtDesc(
                    shop);
            if (unreadNotifications.size() > maxUnreadNotifications) {
              List<Notification> toDelete =
                  unreadNotifications.subList(maxUnreadNotifications, unreadNotifications.size());
              notificationRepository.deleteAll(toDelete);
              deletedCount += toDelete.size();
              log.info("Cleaned up {} unread notifications for shop: {}", toDelete.size(), shop);
            }
          }

          return deletedCount;
        });
  }

  /** Scheduled cleanup task - runs daily at 2 AM */
  @Scheduled(cron = "0 0 2 * * ?")
  public void scheduledCleanup() {
    log.info("Starting scheduled notification cleanup");
    cleanupOldNotifications()
        .subscribe(
            count -> log.info("Scheduled cleanup completed. Deleted {} notifications", count),
            error -> log.error("Scheduled cleanup failed", error));
  }

  /** Get notifications with cleanup policy applied */
  public Mono<List<Notification>> getNotificationsWithCleanup(String shop, String sessionId) {
    return getNotifications(shop, sessionId)
        .flatMap(
            notifications -> {
              // Apply cleanup policy if needed
              if (notifications.size() > maxReadNotifications + maxUnreadNotifications) {
                return cleanupOldNotifications().then(getNotifications(shop, sessionId));
              }
              return Mono.just(notifications);
            });
  }

  public boolean isSendGridEnabled() {
    return sendGridEnabled;
  }

  public boolean isTwilioEnabled() {
    return twilioEnabled;
  }
}
