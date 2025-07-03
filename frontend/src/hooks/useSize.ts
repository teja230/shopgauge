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
    setSize({ width: element.offsetWidth, height: element.offsetHeight });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
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