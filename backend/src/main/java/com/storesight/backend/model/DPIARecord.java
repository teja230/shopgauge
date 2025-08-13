package com.storesight.backend.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "dpia_records")
public class DPIARecord {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "process_name", nullable = false)
  private String processName;

  @Column(name = "purpose", columnDefinition = "TEXT")
  private String purpose;

  @Column(name = "pii_categories", columnDefinition = "TEXT")
  private String piiCategories;

  @Column(name = "risks", columnDefinition = "TEXT")
  private String risks;

  @Column(name = "mitigations", columnDefinition = "TEXT")
  private String mitigations;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @PrePersist
  protected void onCreate() {
    createdAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getProcessName() {
    return processName;
  }

  public void setProcessName(String processName) {
    this.processName = processName;
  }

  public String getPurpose() {
    return purpose;
  }

  public void setPurpose(String purpose) {
    this.purpose = purpose;
  }

  public String getPiiCategories() {
    return piiCategories;
  }

  public void setPiiCategories(String piiCategories) {
    this.piiCategories = piiCategories;
  }

  public String getRisks() {
    return risks;
  }

  public void setRisks(String risks) {
    this.risks = risks;
  }

  public String getMitigations() {
    return mitigations;
  }

  public void setMitigations(String mitigations) {
    this.mitigations = mitigations;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }
}
