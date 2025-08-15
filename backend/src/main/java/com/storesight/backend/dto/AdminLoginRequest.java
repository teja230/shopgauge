package com.storesight.backend.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public class AdminLoginRequest {
  @NotBlank public final String username;

  @NotBlank public final String password;

  // Support both new structured format and legacy Map format
  @JsonCreator
  public AdminLoginRequest(
      @JsonProperty("username") String username, @JsonProperty("password") String password) {
    this.username = username;
    this.password = password;
  }

  // Getters for compatibility
  public String getUsername() {
    return username;
  }

  public String getPassword() {
    return password;
  }
}
