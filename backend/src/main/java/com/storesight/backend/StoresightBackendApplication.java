package com.storesight.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(exclude = {JpaRepositoriesAutoConfiguration.class})
@EnableScheduling
public class StoresightBackendApplication {

  public static void main(String[] args) {
    SpringApplication.run(StoresightBackendApplication.class, args);
  }
}
