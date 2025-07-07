package com.storesight.backend.config;

import jakarta.persistence.EntityManagerFactory;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.orm.jpa.JpaProperties;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * JPA Configuration to fix EntityManagerFactory bean creation issues. This configuration ensures
 * proper EntityManagerFactory bean resolution.
 */
@Configuration
@Profile("!test")
@EnableTransactionManagement
@EnableJpaRepositories(basePackages = "com.storesight.backend.repository")
public class JpaConfig {

  /** Primary EntityManagerFactory bean to fix jpaSharedEM_entityManagerFactory resolution. */
  @Primary
  @Bean(name = "entityManagerFactory")
  @ConditionalOnMissingBean(name = "entityManagerFactory")
  public LocalContainerEntityManagerFactoryBean entityManagerFactory(
      EntityManagerFactoryBuilder builder,
      @Qualifier("dataSource") DataSource dataSource,
      JpaProperties jpaProperties) {

    return builder
        .dataSource(dataSource)
        .packages("com.storesight.backend.model")
        .persistenceUnit("default")
        .properties(jpaProperties.getProperties())
        .build();
  }

  /** Primary TransactionManager bean. */
  @Primary
  @Bean(name = "transactionManager")
  @ConditionalOnMissingBean(name = "transactionManager")
  public PlatformTransactionManager transactionManager(
      @Qualifier("entityManagerFactory") EntityManagerFactory entityManagerFactory) {
    return new JpaTransactionManager(entityManagerFactory);
  }
}
