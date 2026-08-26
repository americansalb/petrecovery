'use client';

/**
 * The brand mark with a deliberate fallback. The logo loads from the CDN;
 * if that fails, the broken image used to render as clipped alt text
 * ("Reuni") in the navbar and doubled the name on auth pages. On error the
 * image removes itself and the neighboring wordmark carries the brand.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { LOGO_ICON } from '@/lib/brandAssets';

export default function BrandLogo({ className = '', alt = 'ReunitePets', width, height, onFail }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  const fail = useCallback(() => {
    setFailed(true);
    if (onFailRef.current) onFailRef.current();
  }, []);

  // The image often fails during the initial HTML load, before React
  // hydrates - that error event is gone by the time onError attaches. A
  // complete image with no natural size is that missed failure.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) fail();
  }, [fail]);

  if (failed) return null;
  return (
    <img
      ref={ref}
      src={LOGO_ICON}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={fail}
    />
  );
}
