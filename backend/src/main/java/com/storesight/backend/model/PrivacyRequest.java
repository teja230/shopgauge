package com.storesight.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "privacy_requests")
public class PrivacyRequest {

  public enum RequestType {
    EXPORT,
    DELETE,
    ANONYMIZE
  }

  public enum Status {
    PENDING,
    PROCESSING,
    COMPLETED,
    FAILED
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "shop_id", nullable = false)
  private Long shopId;

  @Enumerated(EnumType.STRING)
  @Column(name = "request_type", nullable = false)
  private RequestType requestType;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false)
  private Status status = Status.PENDING;

  @Column(name = "requested_at", nullable = false)
  private LocalDateTime requestedAt;

  @Column(name = "processed_at")
  private LocalDateTime processedAt;

  @Column(name = "completed_at")
  private LocalDateTime completedAt;

  @Column(name = "request_details", columnDefinition = "jsonb")
  private String requestDetails;

  @Column(name = "processing_log", columnDefinition = "TEXT")
  private String processingLog;

  @Column(name = "created_by", length = 100)
  private String createdBy;

  @Column(name = "ip_address", columnDefinition = "inet")
  private String ipAddress;

  // Constructors
  public PrivacyRequest() {
    this.requestedAt = LocalDateTime.now();
  }

  public PrivacyRequest(Long shopId, RequestType requestType, String createdBy, String ipAddress) {
    this();
    this.shopId = shopId;
    this.requestType = requestType;
    this.createdBy = createdBy;
    this.ipAddress = ipAddress;
  }

  // Getters and Setters
  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Long getShopId() {
    return shopId;
  }

  public void setShopId(Long shopId) {
    this.shopId = shopId;
  }

  public RequestType getRequestType() {
    return requestType;
  }

  public void setRequestType(RequestType requestType) {
    this.requestType = requestType;
  }

  public Status getStatus() {
    return status;
  }

  public void setStatus(Status status) {
    this.status = status;
  }

  public LocalDateTime getRequestedAt() {
    return requestedAt;
  }

  public void setRequestedAt(LocalDateTime requestedAt) {
    this.requestedAt = requestedAt;
  }

  public LocalDateTime getProcessedAt() {
    return processedAt;
  }

  public void setProcessedAt(LocalDateTime processedAt) {
    this.processedAt = processedAt;
  }

  public LocalDateTime getCompletedAt() {
    return completedAt;
  }

  public void setCompletedAt(LocalDateTime completedAt) {
    this.completedAt = completedAt;
  }

  public String getRequestDetails() {
    return requestDetails;
  }

  public void setRequestDetails(String requestDetails) {
    this.requestDetails = requestDetails;
  }

  public String getProcessingLog() {
    return processingLog;
  }

  public void setProcessingLog(String processingLog) {
    this.processingLog = processingLog;
  }

  public String getCreatedBy() {
    return createdBy;
  }

  public void setCreatedBy(String createdBy) {
    this.createdBy = createdBy;
  }

  public String getIpAddress() {
    return ipAddress;
  }

  public void setIpAddress(String ipAddress) {
    this.ipAddress = ipAddress;
  }

  @Override
  public String toString() {
    return "PrivacyRequest{"
        + "id="
        + id
        + ", shopId="
        + shopId
        + ", requestType="
        + requestType
        + ", status="
        + status
        + ", requestedAt="
        + requestedAt
        + '}';
  }
}
