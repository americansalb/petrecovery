'use client';

/**
 * SaramaLogo - Official Sarama mascot logo
 *
 * Use this component for:
 * - Loading states
 * - Branding elements
 * - Sarama companion avatar
 */

import { SARAMA_AVATAR } from '@/lib/brandAssets';

export default function SaramaLogo({
  size = 64,
  className = '',
  animate = false,
}) {
  return (
    <img
      src={SARAMA_AVATAR}
      alt="Sarama"
      width={size}
      height={size}
      className={`${animate ? 'animate-pulse' : ''} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * SaramaLoading - Animated loading state with Sarama
 */
export function SaramaLoading({ size = 64, text = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="animate-bounce">
        <SaramaLogo size={size} />
      </div>
      {text && <p className="text-gray-500 mt-3 text-sm">{text}</p>}
    </div>
  );
}
