package com.storesight.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class AdminLoginRequest {
  @NotBlank public String username;
  @NotBlank public String password;
}

