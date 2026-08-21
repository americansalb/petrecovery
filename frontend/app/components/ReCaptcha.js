'use client';

/**
 * Phase 5: ReCAPTCHA Component
 *
 * Google reCAPTCHA v2 and v3 integration for form protection.
 * Supports both checkbox (v2) and invisible (v3) modes.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// reCAPTCHA site keys from environment
const RECAPTCHA_V2_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY;
const RECAPTCHA_V3_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;

/**
 * Load the reCAPTCHA script dynamically
 */
const loadRecaptchaScript = (version = 'v2') => {
  return new Promise((resolve, reject) => {
    const scriptId = `recaptcha-script-${version}`;

    // Check if already loaded
    if (document.getElementById(scriptId)) {
      if (window.grecaptcha) {
        resolve(window.grecaptcha);
      } else {
        // Script loaded but grecaptcha not ready
        const checkReady = setInterval(() => {
          if (window.grecaptcha) {
            clearInterval(checkReady);
            resolve(window.grecaptcha);
          }
        }, 100);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;

    if (version === 'v3') {
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_V3_SITE_KEY}`;
    } else {
      script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
    }

    script.async = true;
    script.defer = true;

    window.onRecaptchaLoad = () => {
      resolve(window.grecaptcha);
    };

    script.onload = () => {
      if (version === 'v3' && window.grecaptcha) {
        resolve(window.grecaptcha);
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load reCAPTCHA script'));
    };

    document.head.appendChild(script);
  });
};

/**
 * ReCAPTCHA v2 Checkbox Component
 */
export function ReCaptchaV2({
  onVerify,
  onExpire,
  onError,
  theme = 'light',
  size = 'normal',
  tabIndex = 0,
  className = '',
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!RECAPTCHA_V2_SITE_KEY) {
      console.warn('ReCAPTCHA v2 site key not configured');
      return;
    }

    let mounted = true;

    loadRecaptchaScript('v2')
      .then((grecaptcha) => {
        if (!mounted || !containerRef.current) return;

        // Wait for grecaptcha to be ready
        grecaptcha.ready(() => {
          if (!mounted || !containerRef.current) return;

          try {
            widgetIdRef.current = grecaptcha.render(containerRef.current, {
              sitekey: RECAPTCHA_V2_SITE_KEY,
              theme,
              size,
              tabindex: tabIndex,
              callback: (token) => {
                onVerify?.(token);
              },
              'expired-callback': () => {
                onExpire?.();
              },
              'error-callback': () => {
                setError('ReCAPTCHA error occurred');
                onError?.();
              },
            });
            setIsLoaded(true);
          } catch (err) {
            console.error('Failed to render reCAPTCHA:', err);
            setError('Failed to load reCAPTCHA');
          }
        });
      })
      .catch((err) => {
        console.error('Failed to load reCAPTCHA script:', err);
        setError('Failed to load reCAPTCHA');
      });

    return () => {
      mounted = false;
      if (widgetIdRef.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch (e) {
          // Ignore reset errors
        }
      }
    };
  }, [theme, size, tabIndex, onVerify, onExpire, onError]);

  const reset = useCallback(() => {
    if (widgetIdRef.current !== null && window.grecaptcha) {
      window.grecaptcha.reset(widgetIdRef.current);
    }
  }, []);

  const getResponse = useCallback(() => {
    if (widgetIdRef.current !== null && window.grecaptcha) {
      return window.grecaptcha.getResponse(widgetIdRef.current);
    }
    return '';
  }, []);

  // Expose methods via ref
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.reset = reset;
      containerRef.current.getResponse = getResponse;
    }
  }, [reset, getResponse]);

  if (!RECAPTCHA_V2_SITE_KEY) {
    return (
      <div className={`text-yellow-600 text-sm ${className}`}>
        ReCAPTCHA not configured
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-red-600 text-sm ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} />
      {!isLoaded && (
        <div className="animate-pulse bg-gray-200 h-[78px] w-[304px] rounded" />
      )}
    </div>
  );
}

/**
 * ReCAPTCHA v3 Invisible Component
 *
 * Usage:
 * const { executeRecaptcha } = useReCaptchaV3();
 * const token = await executeRecaptcha('submit_form');
 */
export function useReCaptchaV3() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!RECAPTCHA_V3_SITE_KEY) {
      console.warn('ReCAPTCHA v3 site key not configured');
      return;
    }

    loadRecaptchaScript('v3')
      .then((grecaptcha) => {
        grecaptcha.ready(() => {
          setIsReady(true);
        });
      })
      .catch((err) => {
        console.error('Failed to load reCAPTCHA v3:', err);
        setError('Failed to load reCAPTCHA');
      });
  }, []);

  const executeRecaptcha = useCallback(async (action = 'submit') => {
    if (!RECAPTCHA_V3_SITE_KEY) {
      throw new Error('ReCAPTCHA v3 site key not configured');
    }

    if (!window.grecaptcha) {
      throw new Error('ReCAPTCHA not loaded');
    }

    return new Promise((resolve, reject) => {
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(RECAPTCHA_V3_SITE_KEY, { action });
          resolve(token);
        } catch (err) {
          reject(err);
        }
      });
    });
  }, []);

  return {
    isReady,
    error,
    executeRecaptcha,
  };
}

/**
 * ReCAPTCHA Provider Component for v3
 * Wraps the app to provide reCAPTCHA v3 functionality
 */
export function ReCaptchaProvider({ children }) {
  useEffect(() => {
    if (RECAPTCHA_V3_SITE_KEY) {
      loadRecaptchaScript('v3').catch(console.error);
    }
  }, []);

  return children;
}

/**
 * Invisible reCAPTCHA Component
 * Shows a badge and executes on form submit
 */
export function InvisibleReCaptcha({
  onVerify,
  onError,
  action = 'submit',
  badge = 'bottomright',
  children,
}) {
  const { isReady, executeRecaptcha } = useReCaptchaV3();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = await executeRecaptcha(action);
      onVerify?.(token);
    } catch (err) {
      console.error('ReCAPTCHA execution failed:', err);
      onError?.(err);
    }
  };

  return (
    <form method="post" onSubmit={handleSubmit}>
      {children}
      {!isReady && (
        <div className="text-sm text-gray-500">Loading security check...</div>
      )}
    </form>
  );
}

/**
 * Higher-order component to add reCAPTCHA to any form
 */
export function withReCaptcha(WrappedComponent, options = {}) {
  const { version = 'v3', action = 'submit' } = options;

  return function ReCaptchaWrappedComponent(props) {
    const [captchaToken, setCaptchaToken] = useState(null);
    const captchaRef = useRef(null);

    if (version === 'v2') {
      return (
        <WrappedComponent
          {...props}
          captchaToken={captchaToken}
          captchaRef={captchaRef}
          renderCaptcha={() => (
            <ReCaptchaV2
              ref={captchaRef}
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
            />
          )}
        />
      );
    }

    // v3
    const { executeRecaptcha, isReady } = useReCaptchaV3();

    const getCaptchaToken = async () => {
      const token = await executeRecaptcha(action);
      setCaptchaToken(token);
      return token;
    };

    return (
      <WrappedComponent
        {...props}
        captchaToken={captchaToken}
        getCaptchaToken={getCaptchaToken}
        isCaptchaReady={isReady}
      />
    );
  };
}

export default ReCaptchaV2;
