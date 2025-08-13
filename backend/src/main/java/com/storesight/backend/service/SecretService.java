package com.storesight.backend.service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Secrets management service that reads from a chain of providers. Writes are discouraged in prod.
 */
@Service
public class SecretService implements SecretsProvider {
  private final StringRedisTemplate redisTemplate;
  private final List<SecretsProvider> providers;

  @Value("${secrets.rotation.enabled:true}")
  private boolean rotationEnabled;

  @Value("${secrets.rotation.cron:0 0 3 * * *}")
  private String rotationCron;

  @Autowired
  public SecretService(StringRedisTemplate redisTemplate, List<SecretsProvider> providers) {
    this.redisTemplate = redisTemplate;
    this.providers = providers;
  }

  @Override
  public Optional<String> getSecret(String key) {
    // Chain through providers: env -> existing SecretService redis-backed fallback
    for (SecretsProvider p : providers) {
      if (p == this) continue; // skip self in chain
      Optional<String> val = p.getSecret(key);
      if (val.isPresent()) return val;
    }
    return getFromRedis(key);
  }

  private Optional<String> getFromRedis(String key) {
    String redisKey = mapSecretKeyToEnvVar(key);
    String value = redisTemplate.opsForValue().get("secret:" + redisKey);
    return Optional.ofNullable(value);
  }

  @Override
  public boolean supportsWrite() {
    return true;
  }

  @Override
  public void putSecret(String key, String value) {
    String envVarName = mapSecretKeyToEnvVar(key);
    redisTemplate.opsForValue().set("secret:" + envVarName, value);
  }

  @Override
  public void deleteSecret(String key) {
    String envVarName = mapSecretKeyToEnvVar(key);
    redisTemplate.delete("secret:" + envVarName);
  }

  /** List all configured secrets (returns keys only for security). */
  public Map<String, String> listSecrets() {
    Map<String, String> secrets = new HashMap<>();
    String[] secretKeys = {
      "shopify.api.key",
      "shopify.api.secret",
      "sendgrid.api.key",
      "twilio.account.sid",
      "twilio.auth.token",
      "serpapi.api.key",
      "scrapingdog.api.key",
      "serper.api.key"
    };
    for (String key : secretKeys) {
      if (getSecret(key).isPresent()) {
        secrets.put(key, "[CONFIGURED]");
      }
    }
    return secrets;
  }

  /** Map secret keys to environment variable names. */
  private String mapSecretKeyToEnvVar(String secretKey) {
    switch (secretKey) {
      case "shopify.api.key":
        return "SHOPIFY_API_KEY";
      case "shopify.api.secret":
        return "SHOPIFY_API_SECRET";
      case "sendgrid.api.key":
        return "SENDGRID_API_KEY";
      case "twilio.account.sid":
        return "TWILIO_ACCOUNT_SID";
      case "twilio.auth.token":
        return "TWILIO_AUTH_TOKEN";
      case "serpapi.api.key":
        return "SERPAPI_KEY";
      case "scrapingdog.api.key":
        return "SCRAPINGDOG_KEY";
      case "serper.api.key":
        return "SERPER_KEY";
      default:
        return secretKey.toUpperCase().replace(".", "_");
    }
  }

  // Rotation cadence - runs daily at 3 AM by default (configurable via secrets.rotation.cron)
  @Scheduled(cron = "${secrets.rotation.cron:0 0 3 * * *}")
  public void scheduledRotationCheck() {
    if (!rotationEnabled) return;
    // Hook: check for expiring/soon-to-expire secrets and trigger rotation workflows.
    // Actual rotation is environment/provider-specific and typically happens outside the app.
    // Here we can emit metrics/logs to alert when rotation is due.
    Map<String, String> due = new HashMap<>();
    for (String key :
        new String[] {
          "sendgrid.api.key", "twilio.account.sid", "twilio.auth.token", "shopify.api.secret"
        }) {
      // Placeholder: in a real integration, query provider metadata for expiry
      // For now, simply log that rotation check ran.
      getSecret(key).ifPresent(v -> due.put(key, "present"));
    }
    if (!due.isEmpty()) {
      org.slf4j.LoggerFactory.getLogger(SecretService.class)
          .info("Secrets rotation check executed at {} for keys: {}", Instant.now(), due.keySet());
    }
  }
}
