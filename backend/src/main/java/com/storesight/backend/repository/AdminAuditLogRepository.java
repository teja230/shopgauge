package com.storesight.backend.repository;

import com.storesight.backend.model.AdminAuditLog;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

  List<AdminAuditLog> findByUsernameOrderByTimestampDesc(String username);

  List<AdminAuditLog> findByEventOrderByTimestampDesc(String event);

  List<AdminAuditLog> findByIpAddressOrderByTimestampDesc(String ipAddress);

  @Query("SELECT a FROM AdminAuditLog a WHERE a.timestamp >= :startTime ORDER BY a.timestamp DESC")
  List<AdminAuditLog> findRecentEvents(@Param("startTime") Instant startTime);

  @Query(
      "SELECT a FROM AdminAuditLog a WHERE a.username = :username AND a.timestamp >= :startTime ORDER BY a.timestamp DESC")
  List<AdminAuditLog> findRecentEventsByUsername(
      @Param("username") String username, @Param("startTime") Instant startTime);

  @Query(
      "SELECT COUNT(a) FROM AdminAuditLog a WHERE a.event = 'LOGIN_FAILED' AND a.ipAddress = :ipAddress AND a.timestamp >= :startTime")
  long countFailedLoginAttempts(
      @Param("ipAddress") String ipAddress, @Param("startTime") Instant startTime);
}
