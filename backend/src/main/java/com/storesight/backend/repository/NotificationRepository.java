package com.storesight.backend.repository;

import com.storesight.backend.model.Notification;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {
  List<Notification> findByShopOrderByCreatedAtDesc(String shop);
}
