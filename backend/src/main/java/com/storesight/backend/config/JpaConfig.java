package com.storesight.backend.config;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.orm.jpa.SharedEntityManagerCreator;

/**
 * Minimal JPA configuration to provide the jpaSharedEM_entityManagerFactory bean that Spring Data
 * JPA repositories expect in Spring Boot 3.x.
 */
@Configuration
public class JpaConfig {

  /**
   * Creates the jpaSharedEM_entityManagerFactory bean that Spring Data JPA repositories expect.
   * This bean is a shared EntityManager that delegates to the primary EntityManagerFactory.
   */
  @Bean(name = "jpaSharedEM_entityManagerFactory")
  @ConditionalOnMissingBean(name = "jpaSharedEM_entityManagerFactory")
  public EntityManager jpaSharedEM_entityManagerFactory(
      @Qualifier("entityManagerFactory") EntityManagerFactory entityManagerFactory) {
    return SharedEntityManagerCreator.createSharedEntityManager(entityManagerFactory);
  }
}
