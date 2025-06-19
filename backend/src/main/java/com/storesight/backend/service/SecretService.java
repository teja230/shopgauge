package com.storesight.backend.service;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class SecretService {
  private final StringRedisTemplate redisTemplate;
  private final String encryptionKey; // This should be set via environment variable
  private static final String SECRET_PREFIX = "secret:";

  @Autowired
  public SecretService(StringRedisTemplate redisTemplate) {
    this.redisTemplate = redisTemplate;
    String envKey = System.getenv("SECRETS_ENCRYPTION_KEY");
    if (envKey == null || envKey.isBlank()) {
      // Fallback to a non-encrypted mode for local development.
      // In production, ensure SECRETS_ENCRYPTION_KEY is defined and 16/24/32 chars long for AES.
      System.err.println(
          "[WARN] SECRETS_ENCRYPTION_KEY is not set – storing secrets in plaintext. Please set this env variable in production.");
    }
    this.encryptionKey = envKey; // may be null – handled in encrypt/decrypt
  }

  public void storeSecret(String key, String value) {
    try {
      String encryptedValue = encrypt(value);
      redisTemplate.opsForValue().set(SECRET_PREFIX + key, encryptedValue);
    } catch (Exception e) {
      throw new RuntimeException("Failed to store secret", e);
    }
  }

  public Optional<String> getSecret(String key) {
    try {
      String encryptedValue = redisTemplate.opsForValue().get(SECRET_PREFIX + key);
      if (encryptedValue == null) {
        return Optional.empty();
      }
      return Optional.of(decrypt(encryptedValue));
    } catch (Exception e) {
      throw new RuntimeException("Failed to retrieve secret", e);
    }
  }

  public void deleteSecret(String key) {
    redisTemplate.delete(SECRET_PREFIX + key);
  }

  private String encrypt(String value) throws Exception {
    if (encryptionKey == null || encryptionKey.length() < 16) {
      // No encryption key – return value as is
      return value;
    }
    SecretKeySpec secretKey =
        new SecretKeySpec(encryptionKey.getBytes(StandardCharsets.UTF_8), "AES");
    Cipher cipher = Cipher.getInstance("AES");
    cipher.init(Cipher.ENCRYPT_MODE, secretKey);
    byte[] encryptedBytes = cipher.doFinal(value.getBytes());
    return Base64.getEncoder().encodeToString(encryptedBytes);
  }

  private String decrypt(String encrypted) throws Exception {
    if (encryptionKey == null || encryptionKey.length() < 16) {
      // Stored plaintext
      return encrypted;
    }
    SecretKeySpec secretKey =
        new SecretKeySpec(encryptionKey.getBytes(StandardCharsets.UTF_8), "AES");
    Cipher cipher = Cipher.getInstance("AES");
    cipher.init(Cipher.DECRYPT_MODE, secretKey);
    byte[] decryptedBytes = cipher.doFinal(Base64.getDecoder().decode(encrypted));
    return new String(decryptedBytes);
  }

  public Map<String, String> listSecrets() {
    java.util.Set<String> keys = redisTemplate.keys(SECRET_PREFIX + "*");
    java.util.Map<String, String> result = new java.util.HashMap<>();
    if (keys != null) {
      for (String redisKey : keys) {
        String key = redisKey.substring(SECRET_PREFIX.length());
        try {
          String encrypted = redisTemplate.opsForValue().get(redisKey);
          if (encrypted != null) {
            result.put(key, decrypt(encrypted));
          }
        } catch (Exception e) {
          // skip problematic secret
        }
      }
    }
    return result;
  }
}
