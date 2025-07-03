/**
 * Dimension utilities for consistent sizing across components
 */

// Chart dimension constants
export const CHART_DIMENSIONS = {
  DEFAULT_HEIGHT: 280,
  MIN_HEIGHT: 200,
  MIN_WIDTH: 200,
  FALLBACK_WIDTH: 0,
  FALLBACK_HEIGHT: 0,
} as const;

// Spacing constants using a consistent scale
export const SPACING = {
  SMALL: 6,
  MEDIUM: 10,
  LARGE: 14,
  XLARGE: 20,
} as const;

/**
 * Safely extracts dimension from an HTML element
 * @param element - The HTML element to measure
 * @param dimension - The dimension to extract ('width' or 'height')
 * @returns The measured dimension or fallback value
 */
export function getElementDimension(
  element: HTMLElement | null,
  dimension: 'width' | 'height'
): number {
  if (!element) {
    return dimension === 'width' ? CHART_DIMENSIONS.FALLBACK_WIDTH : CHART_DIMENSIONS.FALLBACK_HEIGHT;
  }

  try {
    const value = dimension === 'width' ? element.offsetWidth : element.offsetHeight;
    
    // Ensure we have a positive, finite number
    if (typeof value === 'number' && isFinite(value) && value >= 0) {
      return value;
    }
    
    return dimension === 'width' ? CHART_DIMENSIONS.FALLBACK_WIDTH : CHART_DIMENSIONS.FALLBACK_HEIGHT;
  } catch (error) {
    console.warn(`Failed to get element ${dimension}:`, error);
    return dimension === 'width' ? CHART_DIMENSIONS.FALLBACK_WIDTH : CHART_DIMENSIONS.FALLBACK_HEIGHT;
  }
}

/**
 * Gets both width and height dimensions from an element
 * @param element - The HTML element to measure
 * @returns Object with width and height properties
 */
export function getElementDimensions(element: HTMLElement | null): { width: number; height: number } {
  return {
    width: getElementDimension(element, 'width'),
    height: getElementDimension(element, 'height'),
  };
}

/**
 * Ensures a height value meets minimum requirements
 * @param height - The height value to validate
 * @returns A valid height that meets minimum requirements
 */
export function ensureMinHeight(height: number): number {
  return Math.max(height, CHART_DIMENSIONS.MIN_HEIGHT);
}

/**
 * Ensures a width value meets minimum requirements
 * @param width - The width value to validate
 * @returns A valid width that meets minimum requirements
 */
export function ensureMinWidth(width: number): number {
  return Math.max(width, CHART_DIMENSIONS.MIN_WIDTH);
} 