package com.storesight.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = "com.storesight.backend")
public class StoresightBackendApplication {

  public static void main(String[] args) {
    SpringApplication.run(StoresightBackendApplication.class, args);
  }
}
