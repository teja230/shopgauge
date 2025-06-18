package com.storesight.backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class InsightsService {
  @Autowired private NotificationService notificationService;

  // TODO: Move KPI logic here
}

interface IndustryBenchmarkService {
  double getConversionRateBenchmark();
}

@Service
class DefaultIndustryBenchmarkService implements IndustryBenchmarkService {
  @Override
  public double getConversionRateBenchmark() {
    return 1.5; // Hard-coded for MVP
  }
}
