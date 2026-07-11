import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  preventDefault?: boolean;
}

export interface UseKeyboardNavigationOptions {
  shortcuts?: KeyboardShortcut[];
  enableArrowNavigation?: boolean;
  enableTabTrapping?: boolean;
  onEscape?: () => void;
}

export const useKeyboardNavigation = (options: UseKeyboardNavigationOptions = {}) => {
  const {
    shortcuts = [],
    enableArrowNavigation = false,
    enableTabTrapping = false,
    onEscape,
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const focusableElementsRef = useRef<HTMLElement[]>([]);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="menuitem"]:not([aria-disabled="true"])',
      '[role="tab"]:not([aria-disabled="true"])',
    ].join(', ');

    const elements = Array.from(
      containerRef.current.querySelectorAll(focusableSelectors)
    ) as HTMLElement[];

    return elements.filter(element => {
      // Geometry checks report every element as hidden in non-layout environments and can also
      // exclude valid controls during CSS transitions. Explicit hidden state is deterministic.
      const style = window.getComputedStyle(element);
      return (
        !element.hidden &&
        element.getAttribute('aria-hidden') !== 'true' &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    });
  }, []);

  // Update focusable elements list
  const updateFocusableElements = useCallback(() => {
    focusableElementsRef.current = getFocusableElements();
  }, [getFocusableElements]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Handle escape key
    if (event.key === 'Escape' && onEscape) {
      onEscape();
      return;
    }

    // Handle keyboard shortcuts
    for (const shortcut of shortcuts) {
      const matchesKey = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const matchesCtrl = !!shortcut.ctrlKey === event.ctrlKey;
      const matchesAlt = !!shortcut.altKey === event.altKey;
      const matchesShift = !!shortcut.shiftKey === event.shiftKey;
      const matchesMeta = !!shortcut.metaKey === event.metaKey;

      if (matchesKey && matchesCtrl && matchesAlt && matchesShift && matchesMeta) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action();
        return;
      }
    }

    // Handle arrow navigation
    if (enableArrowNavigation && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      handleArrowNavigation(event);
    }

    // Handle tab trapping
    if (enableTabTrapping && event.key === 'Tab') {
      handleTabTrapping(event);
    }
  }, [shortcuts, enableArrowNavigation, enableTabTrapping, onEscape]);

  // Handle arrow key navigation
  const handleArrowNavigation = useCallback((event: KeyboardEvent) => {
    const focusableElements = focusableElementsRef.current;
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowUp':
        nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        break;
      case 'ArrowDown':
        nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'ArrowLeft':
        nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        break;
      case 'ArrowRight':
        nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
        break;
    }

    if (nextIndex !== currentIndex) {
      event.preventDefault();
      focusableElements[nextIndex]?.focus();
    }
  }, []);

  // Handle tab trapping within container
  const handleTabTrapping = useCallback((event: KeyboardEvent) => {
    const focusableElements = focusableElementsRef.current;
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab (backward)
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab (forward)
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  // Focus first focusable element
  const focusFirst = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [getFocusableElements]);

  // Focus last focusable element
  const focusLast = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus();
    }
  }, [getFocusableElements]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Update focusable elements on mount and when DOM changes
    updateFocusableElements();

    // Set up mutation observer to track DOM changes
    const observer = new MutationObserver(updateFocusableElements);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'tabindex', 'aria-disabled'],
    });

    // Shortcuts must still work when the container itself is not focusable. Arrow and tab
    // navigation remain scoped because their handlers require an active element in this container.
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, updateFocusableElements]);

  return {
    containerRef,
    focusFirst,
    focusLast,
    updateFocusableElements,
  };
};

// Hook for managing focus announcements for screen readers
export const useFocusAnnouncement = () => {
  const announcementRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcementRef.current) return;

    announcementRef.current.setAttribute('aria-live', priority);
    announcementRef.current.textContent = message;

    // Clear the message after a short delay to allow for re-announcements
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = '';
      }
    }, 1000);
  }, []);

  const AnnouncementRegion = useCallback(() => {
    return {
      announcementRef,
    };
  }, []);

  return {
    announce,
    AnnouncementRegion,
  };
};

// Common keyboard shortcuts for admin interface
export const ADMIN_KEYBOARD_SHORTCUTS = {
  TOGGLE_SIDEBAR: { key: 'b', ctrlKey: true, description: 'Toggle sidebar' },
  REFRESH_DATA: { key: 'r', ctrlKey: true, description: 'Refresh data' },
  SEARCH: { key: 'k', ctrlKey: true, description: 'Focus search' },
  HELP: { key: '?', description: 'Show keyboard shortcuts' },
  ESCAPE: { key: 'Escape', description: 'Close modal/menu' },
  DASHBOARD: { key: 'd', altKey: true, description: 'Go to dashboard' },
  HEALTH: { key: 'h', altKey: true, description: 'Go to health summary' },
  SESSIONS: { key: 's', altKey: true, description: 'Go to sessions' },
  AUDIT: { key: 'a', altKey: true, description: 'Go to audit logs' },
  MONITORING: { key: 'm', altKey: true, description: 'Go to monitoring' },
} as const;
