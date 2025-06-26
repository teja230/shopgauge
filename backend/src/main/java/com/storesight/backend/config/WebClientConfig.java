package com.storesight.backend.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Configuration
public class WebClientConfig {

  @Bean
  public WebClient.Builder webClientBuilder() {
    // Configure connection provider with robust settings
    ConnectionProvider connectionProvider =
        ConnectionProvider.builder("custom")
            .maxConnections(200)
            .maxIdleTime(Duration.ofSeconds(60))
            .maxLifeTime(Duration.ofMinutes(10))
            .pendingAcquireTimeout(Duration.ofSeconds(30))
            .evictInBackground(Duration.ofSeconds(120))
            .build();

    // Configure HTTP client with timeouts
    HttpClient httpClient =
        HttpClient.create(connectionProvider)
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 30000)
            .responseTimeout(Duration.ofSeconds(60))
            .doOnConnected(
                conn ->
                    conn.addHandlerLast(new ReadTimeoutHandler(60, TimeUnit.SECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(60, TimeUnit.SECONDS)))
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
