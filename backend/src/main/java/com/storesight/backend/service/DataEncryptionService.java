package com.storesight.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service for encrypting and decrypting sensitive competitor data Uses AES-256-GCM for
 * authenticated encryption
 */
@Service
public class DataEncryptionService {

  private static final Logger logger = LoggerFactory.getLogger(DataEncryptionService.class);

  private static final String ALGORITHM = "AES";
  private static final String TRANSFORMATION = "AES/GCM/NoPadding";
  private static final int GCM_IV_LENGTH = 12;
  private static final int GCM_TAG_LENGTH = 16;

  private final SecretKey secretKey;
  private final SecureRandom secureRandom;

  public DataEncryptionService(@Value("${security.encryption.key:}") String encryptionKey) {
    this.secureRandom = new SecureRandom();

    SecretKey key;
    if (encryptionKey != null && !encryptionKey.trim().isEmpty()) {
      // Use provided key (base64 encoded)
      try {
        byte[] keyBytes = Base64.getDecoder().decode(encryptionKey);
        key = new SecretKeySpec(keyBytes, ALGORITHM);
        logger.info("Using provided encryption key");
      } catch (Exception e) {
        logger.warn("Invalid encryption key provided, generating new one: {}", e.getMessage());
        key = generateKey();
      }
    } else {
      // Generate new key for development
      key = generateKey();
      logger.warn(
          "No encryption key provided, using generated key. Set security.encryption.key in production!");
    }
    this.secretKey = key;
  }

  /** Encrypt sensitive text data */
  public String encrypt(String plainText) {
    if (plainText == null || plainText.isEmpty()) {
      return plainText;
    }

    try {
      byte[] iv = new byte[GCM_IV_LENGTH];
      secureRandom.nextBytes(iv);

      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
      cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);

      byte[] encryptedData = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

      // Combine IV and encrypted data
      byte[] encryptedWithIv = new byte[GCM_IV_LENGTH + encryptedData.length];
      System.arraycopy(iv, 0, encryptedWithIv, 0, GCM_IV_LENGTH);
      System.arraycopy(encryptedData, 0, encryptedWithIv, GCM_IV_LENGTH, encryptedData.length);

      return Base64.getEncoder().encodeToString(encryptedWithIv);
    } catch (Exception e) {
      logger.error("Failed to encrypt data: {}", e.getMessage());
      throw new SecurityException("Encryption failed", e);
    }
  }

  /** Decrypt sensitive text data */
  public String decrypt(String encryptedText) {
    if (encryptedText == null || encryptedText.isEmpty()) {
      return encryptedText;
    }

    try {
      byte[] encryptedWithIv = Base64.getDecoder().decode(encryptedText);

      // Extract IV and encrypted data
      byte[] iv = new byte[GCM_IV_LENGTH];
      byte[] encryptedData = new byte[encryptedWithIv.length - GCM_IV_LENGTH];
      System.arraycopy(encryptedWithIv, 0, iv, 0, GCM_IV_LENGTH);
      System.arraycopy(encryptedWithIv, GCM_IV_LENGTH, encryptedData, 0, encryptedData.length);

      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv);
      cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);

      byte[] decryptedData = cipher.doFinal(encryptedData);
      return new String(decryptedData, StandardCharsets.UTF_8);
    } catch (Exception e) {
      logger.error("Failed to decrypt data: {}", e.getMessage());
      throw new SecurityException("Decryption failed", e);
    }
  }

  /** Check if a string appears to be encrypted (base64 format) */
  public boolean isEncrypted(String text) {
    if (text == null || text.isEmpty()) {
      return false;
    }

    try {
      byte[] decoded = Base64.getDecoder().decode(text);
      return decoded.length > GCM_IV_LENGTH; // Must have at least IV + some data
    } catch (Exception e) {
      return false;
    }
  }

  /** Generate a new AES-256 key */
  private SecretKey generateKey() {
    try {
      KeyGenerator keyGenerator = KeyGenerator.getInstance(ALGORITHM);
      keyGenerator.init(256);
      SecretKey key = keyGenerator.generateKey();

      // Log the base64 encoded key for configuration
      String encodedKey = Base64.getEncoder().encodeToString(key.getEncoded());
      logger.info("Generated encryption key (add to config): {}", encodedKey);

      return key;
    } catch (Exception e) {
      throw new RuntimeException("Failed to generate encryption key", e);
    }
  }
}
