package com.storesight.backend.service;

import java.util.Optional;

public interface SecretsProvider {
  Optional<String> getSecret(String key);

  default boolean supportsWrite() {
    return false;
  }

  default void putSecret(String key, String value) {}

  default void deleteSecret(String key) {}
}
