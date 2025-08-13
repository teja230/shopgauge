package com.storesight.backend.compliance;

import com.storesight.backend.service.SecretService;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** AES-GCM encryption service for field-level encryption. */
@Service
public class FieldLevelCryptoService {

  private static final Logger log = LoggerFactory.getLogger(FieldLevelCryptoService.class);
  private static final String SECRET_KEY_NAME = "crypto.field.key";
  private static final int IV_LENGTH = 12; // 96-bit nonce for GCM
  private static final int TAG_BITS = 128;

  private final SecretService secretService;
  private final SecureRandom secureRandom = new SecureRandom();

  public FieldLevelCryptoService(SecretService secretService) {
    this.secretService = secretService;
  }

  public String encrypt(String plaintext) {
    if (plaintext == null) return null;
    try {
      SecretKey key = resolveKey();
      byte[] iv = new byte[IV_LENGTH];
      secureRandom.nextBytes(iv);

      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

      ByteBuffer buffer = ByteBuffer.allocate(iv.length + ciphertext.length);
      buffer.put(iv);
      buffer.put(ciphertext);
      return Base64.getEncoder().encodeToString(buffer.array());
    } catch (GeneralSecurityException e) {
      log.error("Field encryption failed: {}", e.getMessage());
      throw new IllegalStateException("Encryption failed", e);
    }
  }

  public String decrypt(String encoded) {
    if (encoded == null) return null;
    try {
      SecretKey key = resolveKey();
      byte[] all = Base64.getDecoder().decode(encoded);
      ByteBuffer buffer = ByteBuffer.wrap(all);
      byte[] iv = new byte[IV_LENGTH];
      buffer.get(iv);
      byte[] ciphertext = new byte[buffer.remaining()];
      buffer.get(ciphertext);

      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      byte[] plaintext = cipher.doFinal(ciphertext);
      return new String(plaintext, StandardCharsets.UTF_8);
    } catch (GeneralSecurityException e) {
      log.error("Field decryption failed: {}", e.getMessage());
      throw new IllegalStateException("Decryption failed", e);
    }
  }

  private SecretKey resolveKey() {
    String keyB64 = secretService.getSecret(SECRET_KEY_NAME).orElseGet(this::initializeKey);
    byte[] keyBytes = Base64.getDecoder().decode(keyB64);
    return new SecretKeySpec(keyBytes, "AES");
  }

  private String initializeKey() {
    byte[] keyBytes = new byte[32]; // 256-bit key
    secureRandom.nextBytes(keyBytes);
    String b64 = Base64.getEncoder().encodeToString(keyBytes);
    try {
      secretService.putSecret(SECRET_KEY_NAME, b64);
    } catch (Exception e) {
      log.warn("Could not persist field crypto key: {}", e.getMessage());
    }
    return b64;
  }
}
