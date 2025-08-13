package com.storesight.backend.compliance;

import jakarta.persistence.Entity;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.reflections.Reflections;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Scans JPA entities for fields annotated with @PII and returns an inventory. */
@Service
public class PIIInventoryService {
  private static final Logger log = LoggerFactory.getLogger(PIIInventoryService.class);

  public List<Map<String, Object>> scan(String basePackage) {
    List<Map<String, Object>> results = new ArrayList<>();
    try {
      Reflections reflections = new Reflections(basePackage);
      var entities = reflections.getTypesAnnotatedWith(Entity.class);
      for (Class<?> entityClass : entities) {
        for (Field field : entityClass.getDeclaredFields()) {
          PII pii = field.getAnnotation(PII.class);
          if (pii != null) {
            Map<String, Object> row = new HashMap<>();
            row.put("entity", entityClass.getName());
            row.put("field", field.getName());
            row.put("category", pii.value().name());
            results.add(row);
          }
        }
      }
    } catch (Exception e) {
      log.error("PII scan failed: {}", e.getMessage(), e);
    }
    return results;
  }
}
