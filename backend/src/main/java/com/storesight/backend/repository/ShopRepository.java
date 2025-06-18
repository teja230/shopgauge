package com.storesight.backend.repository;

import com.storesight.backend.model.Shop;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ShopRepository extends JpaRepository<Shop, Long> {
  Optional<Shop> findByShopifyDomain(String shopifyDomain);
}
