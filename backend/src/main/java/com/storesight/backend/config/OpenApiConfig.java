package com.storesight.backend.config;

import io.swagger.v3.oas.models.ExternalDocumentation;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

  @Bean
  public OpenAPI shopgaugeOpenAPI() {
    return new OpenAPI()
        .info(
            new Info()
                .title("ShopGauge API")
                .description("ShopGauge backend API")
                .version("v1")
                .contact(new Contact().name("ShopGauge").url("https://shopgaugeai.com"))
                .license(new License().name("Proprietary")))
        .externalDocs(
            new ExternalDocumentation()
                .description("Documentation")
                .url("https://shopgaugeai.com/docs"));
  }
}
