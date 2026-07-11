package com.storesight.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ProductInterestRequest(
    @NotBlank
        @Pattern(regexp = "starter|growth|pro", message = "plan must be starter, growth, or pro")
        String plan,
    @NotBlank @Size(max = 80) String source,
    @NotBlank
        @Pattern(regexp = "1-100|101-500|501-2000", message = "invalid monitored listings band")
        String monitoredListingsBand) {}
