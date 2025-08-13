package com.storesight.backend.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

@Configuration
public class WebClientConfig {

  @Value("${http.client.connect-timeout-ms:30000}")
  private int connectTimeoutMs;

  @Value("${http.client.read-timeout-ms:60000}")
  private int readTimeoutMs;

  @Value("${http.client.write-timeout-ms:60000}")
  private int writeTimeoutMs;

  @Value("${http.client.max-connections:200}")
  private int maxConnections;

  @Bean
  public WebClient.Builder webClientBuilder() {
    ConnectionProvider connectionProvider =
        ConnectionProvider.builder("custom")
            .maxConnections(maxConnections)
            .maxIdleTime(Duration.ofSeconds(60))
            .maxLifeTime(Duration.ofMinutes(10))
            .pendingAcquireTimeout(Duration.ofSeconds(30))
            .evictInBackground(Duration.ofSeconds(120))
            .build();

    HttpClient httpClient =
        HttpClient.create(connectionProvider)
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, connectTimeoutMs)
            .responseTimeout(Duration.ofMillis(readTimeoutMs))
            .doOnConnected(
                conn ->
                    conn.addHandlerLast(
                            new ReadTimeoutHandler(readTimeoutMs, TimeUnit.MILLISECONDS))
                        .addHandlerLast(
                            new WriteTimeoutHandler(writeTimeoutMs, TimeUnit.MILLISECONDS)))
            .keepAlive(true)
            .compress(true);

    return WebClient.builder()
        .clientConnector(new ReactorClientHttpConnector(httpClient))
        .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(10 * 1024 * 1024));
  }

  @Bean
  public WebClient webClient(WebClient.Builder webClientBuilder) {
    return webClientBuilder.build();
  }
}
