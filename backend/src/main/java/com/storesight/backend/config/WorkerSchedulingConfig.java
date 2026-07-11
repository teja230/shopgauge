package com.storesight.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Enables scheduled work only in dedicated scheduler and scraper worker processes. */
@Configuration
@EnableScheduling
@Profile({"scheduler", "worker"})
public class WorkerSchedulingConfig {}
