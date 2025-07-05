package com.storesight.backend.config;

import io.lettuce.core.ClientOptions;
import io.lettuce.core.SocketOptions;
import io.lettuce.core.TimeoutOptions;
import io.lettuce.core.resource.ClientResources;
import io.lettuce.core.resource.DefaultClientResources;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@Profile("!test")
public class RedisConfig {

  private static final Logger logger = LoggerFactory.getLogger(RedisConfig.class);

  @Value("${spring.redis.host:localhost}")
  private String redisHost;

  @Value("${spring.redis.port:6379}")
  private int redisPort;

  @Value("${spring.redis.password:}")
  private String redisPassword;

  private final Environment environment;

  public RedisConfig(Environment environment) {
    this.environment = environment;
  }

  @Bean
  public ClientResources clientResources() {
    return DefaultClientResources.builder()
        .ioThreadPoolSize(4)
        .computationThreadPoolSize(4)
        .build();
  }

  @Bean
  public RedisConnectionFactory redisConnectionFactory(ClientResources clientResources) {
    boolean isProduction = isProductionEnvironment();
    logger.info(
        "Configuring Redis connection to {}:{} (production: {})",
        redisHost,
        redisPort,
        isProduction);

    RedisStandaloneConfiguration redisConfig = new RedisStandaloneConfiguration();
    redisConfig.setHostName(redisHost);
    redisConfig.setPort(redisPort);

    if (redisPassword != null && !redisPassword.isEmpty()) {
      redisConfig.setPassword(redisPassword);
      logger.info("Redis password configured");
    }

    // Enhanced socket options for better reliability
    SocketOptions socketOptions =
        SocketOptions.builder()
            .connectTimeout(Duration.ofSeconds(isProduction ? 15 : 10)) // Increased from 10s
            .keepAlive(true)
            .tcpNoDelay(true)
            .build();

    // Enhanced timeout options for better performance and reliability
    TimeoutOptions timeoutOptions =
        TimeoutOptions.builder()
            .fixedTimeout(Duration.ofSeconds(isProduction ? 10 : 5)) // Increased from 5s
            .timeoutCommands(true) // Enable command timeouts
            .build();

    // Enhanced client options for production stability
    ClientOptions clientOptions =
        ClientOptions.builder()
            .socketOptions(socketOptions)
            .timeoutOptions(timeoutOptions)
            .disconnectedBehavior(ClientOptions.DisconnectedBehavior.REJECT_COMMANDS)
            .autoReconnect(true)
            .cancelCommandsOnReconnectFailure(true) // Cancel commands on reconnect failure
            .pingBeforeActivateConnection(true) // Ping before activating connection
            .suspendReconnectOnProtocolFailure(true) // Suspend reconnect on failure
            .build();

    // Build lettuce configuration with enhanced settings
    LettuceClientConfiguration.LettuceClientConfigurationBuilder configBuilder =
        LettuceClientConfiguration.builder()
            .clientOptions(clientOptions)
            .clientResources(clientResources)
            .commandTimeout(Duration.ofSeconds(isProduction ? 8 : 5)); // Increased timeout

    // Add shutdown timeout for graceful shutdown
    if (isProduction) {
      configBuilder.shutdownTimeout(Duration.ofSeconds(10));
    }

    LettuceClientConfiguration lettuceConfig = configBuilder.build();

    LettuceConnectionFactory factory = new LettuceConnectionFactory(redisConfig, lettuceConfig);
    factory.setValidateConnection(true);
    factory.setShareNativeConnection(true); // Share native connection for better performance

    logger.info(
        "Redis connection factory configured with enhanced timeouts and reliability settings");
    return factory;
  }

  @Bean
  public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
    StringRedisTemplate template = new StringRedisTemplate();
    template.setConnectionFactory(connectionFactory);
    template.setEnableTransactionSupport(
        false); // Disable transaction support for better performance
    template.setDefaultSerializer(template.getStringSerializer()); // Explicit serializer

    // Test Redis connection on startup
    try {
      template.opsForValue().set("redis_config_test", "test", Duration.ofSeconds(10));
      String testResult = template.opsForValue().get("redis_config_test");
      if ("test".equals(testResult)) {
        logger.info("Redis connection test successful");
        template.delete("redis_config_test"); // Clean up test key
      } else {
        logger.warn("Redis connection test failed - unexpected result: {}", testResult);
      }
    } catch (Exception e) {
      logger.warn("Redis connection test failed - Redis may be unavailable: {}", e.getMessage());
      // Don't fail startup, let the application continue with database fallback
    }

    return template;
  }

  private boolean isProductionEnvironment() {
    String[] activeProfiles = environment.getActiveProfiles();
    for (String profile : activeProfiles) {
      if ("prod".equals(profile) || "production".equals(profile)) {
        return true;
      }
    }
    return false;
  }
}
