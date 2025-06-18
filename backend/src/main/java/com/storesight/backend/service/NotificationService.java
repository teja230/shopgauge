package com.storesight.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.storesight.backend.model.Notification;
import com.storesight.backend.repository.NotificationRepository;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Service
public class NotificationService {
  private final StringRedisTemplate stringRedisTemplate;
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final WebClient webClient = WebClient.create();
  private final NotificationRepository notificationRepository;

  @Value("${sendgrid.api_key:YOUR_SENDGRID_API_KEY}")
  private String sendGridApiKey;

  @Value("${twilio.account_sid:YOUR_TWILIO_SID}")
  private String twilioAccountSid;

  @Value("${twilio.auth_token:YOUR_TWILIO_AUTH_TOKEN}")
  private String twilioAuthToken;

  @Value("${twilio.from_number:+1234567890}")
  private String twilioFromNumber;

  @Autowired
  public NotificationService(
      StringRedisTemplate stringRedisTemplate, NotificationRepository notificationRepository) {
    this.stringRedisTemplate = stringRedisTemplate;
    this.notificationRepository = notificationRepository;
  }

  public void sendEmailAlert(String to, String subject, String body) {
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
        .subscribe();
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
        .subscribe();
  }

  public void sendSmsAlert(String phoneNumber, String message) {
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
        .subscribe();
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
}
