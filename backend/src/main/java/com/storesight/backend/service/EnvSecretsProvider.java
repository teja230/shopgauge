package com.storesight.backend.service;

import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class EnvSecretsProvider implements SecretsProvider {
  @Override
  public Optional<String> getSecret(String key) {
    String envVarName = key.toUpperCase().replace('.', '_');
    return Optional.ofNullable(System.getenv(envVarName));
  }
}
