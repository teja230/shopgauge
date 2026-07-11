package com.storesight.backend.service;

import com.storesight.backend.model.Shop;
import com.storesight.backend.repository.ShopRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class TenantAuthorizationService {
  private final ShopRepository shopRepository;

  public TenantAuthorizationService(ShopRepository shopRepository) {
    this.shopRepository = shopRepository;
  }

  public Shop requireShop(Long requestedShopId, Authentication authentication) {
    if (authentication == null || !authentication.isAuthenticated()) {
      throw new AccessDeniedException("Shop authentication is required");
    }
    Shop authenticatedShop =
        shopRepository
            .findByShopifyDomain(authentication.getName())
            .orElseThrow(() -> new AccessDeniedException("Authenticated shop was not found"));
    if (!authenticatedShop.getId().equals(requestedShopId)) {
      throw new AccessDeniedException("The requested resource belongs to another shop");
    }
    return authenticatedShop;
  }
}
