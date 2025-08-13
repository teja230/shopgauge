package com.storesight.backend.compliance;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** JPA converter that transparently encrypts/decrypts String fields. */
@Converter
@Component
public class AesGcmStringConverter implements AttributeConverter<String, String> {

  private static FieldLevelCryptoService cryptoService;

  @Autowired
  public void setCryptoService(FieldLevelCryptoService service) {
    AesGcmStringConverter.cryptoService = service;
  }

  @Override
  public String convertToDatabaseColumn(String attribute) {
    if (attribute == null || attribute.isEmpty()) return attribute;
    if (cryptoService == null) return attribute; // fallback for early JPA init
    return cryptoService.encrypt(attribute);
  }

  @Override
  public String convertToEntityAttribute(String dbData) {
    if (dbData == null || dbData.isEmpty()) return dbData;
    if (cryptoService == null) return dbData; // fallback for early JPA init
    try {
      return cryptoService.decrypt(dbData);
    } catch (IllegalStateException ex) {
      // Backward compatibility: return as-is if not in expected encrypted format
      return dbData;
    } catch (Exception ex) {
      return dbData;
    }
  }
}
