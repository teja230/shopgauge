package com.storesight.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ComponentScan(basePackages = "com.storesight.backend")
@EnableJpaRepositories(basePackages = "com.storesight.backend.repository")
@EnableScheduling
public class StoresightBackendApplication {

  public static void main(String[] args) {
    SpringApplication.run(StoresightBackendApplication.class, args);
  }
}
