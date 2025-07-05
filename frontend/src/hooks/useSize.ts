import { useEffect, useState } from 'react';

/**
 * useSize – a resilient, enterprise-grade hook that continuously measures the
 * width and height of a target element using ResizeObserver. The measurement
 * persists for the lifetime of the component and automatically updates on
 * resize events, providing a simple `{ width, height }` object.
 */
export default function useSize<T extends HTMLElement = HTMLElement>(
  targetRef: React.RefObject<T>
) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;

    // Initialise with the element's current size so the first render has data.
    // If `offsetWidth` is 0 (which can happen when the element is invisible
    // during the first paint), we fall back to `getBoundingClientRect()` and
    // finally `window.innerWidth` so that consumers relying on a >0 width do
    // not get stuck in a perpetual loading state.
    const rect = element.getBoundingClientRect();
    const initialWidth = element.offsetWidth || rect.width || window.innerWidth;
    const initialHeight = element.offsetHeight || rect.height || window.innerHeight;
    setSize({ width: initialWidth, height: initialHeight });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          const observedWidth = entry.contentRect.width || entry.target.getBoundingClientRect().width || window.innerWidth;
          const observedHeight = entry.contentRect.height || entry.target.getBoundingClientRect().height || window.innerHeight;
          setSize({
            width: observedWidth,
            height: observedHeight,
          });
        }
      }
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [targetRef]);

  return size;
} 