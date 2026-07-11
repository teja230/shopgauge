package com.storesight.backend.service;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.storesight.backend.model.Shop;
import com.storesight.backend.repository.ShopRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

class TenantAuthorizationServiceTest {
  @Test
  void preventsAuthenticatedShopFromSelectingAnotherTenantId() {
    ShopRepository repository = mock(ShopRepository.class);
    Shop shop = mock(Shop.class);
    when(shop.getId()).thenReturn(42L);
    when(repository.findByShopifyDomain("merchant.myshopify.com")).thenReturn(Optional.of(shop));
    TenantAuthorizationService service = new TenantAuthorizationService(repository);
    UsernamePasswordAuthenticationToken authentication =
        UsernamePasswordAuthenticationToken.authenticated(
            "merchant.myshopify.com", null, java.util.List.of());

    assertSame(shop, service.requireShop(42L, authentication));
    assertThrows(AccessDeniedException.class, () -> service.requireShop(99L, authentication));
  }
}
