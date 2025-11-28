'use client';

/**
 * Phase 6: Phone Verification Component
 *
 * Component for verifying phone numbers for SMS notifications.
 */

import { useState, useRef, useEffect } from 'react';

export default function PhoneVerification({
  onVerified,
  initialPhone = '',
  className = '',
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState('phone'); // 'phone' | 'code' | 'verified'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Format phone number as user types
  const formatPhoneInput = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhone(formatted);
    setError('');
  };

  const handleSendCode = async () => {
    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: `+1${cleaned}` }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setStep('code');
      setCountdown(60); // 60 second cooldown
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (value && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleVerifyCode(fullCode);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      handleVerifyCode(pasted);
    }
  };

  const handleVerifyCode = async (codeString = code.join('')) => {
    if (codeString.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleaned = phone.replace(/\D/g, '');
      const response = await fetch('/api/sms/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: `+1${cleaned}`,
          code: codeString,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      setStep('verified');
      onVerified?.(`+1${cleaned}`);
    } catch (err) {
      setError(err.message);
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (countdown > 0) return;
    setCode(['', '', '', '', '', '']);
    handleSendCode();
  };

  const handleChangeNumber = () => {
    setStep('phone');
    setCode(['', '', '', '', '', '']);
    setError('');
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {step === 'phone' && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Phone Number
            </label>
            <div className="flex gap-2">
              <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-500">
                +1
              </span>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-r-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              We'll send a verification code to this number
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={handleSendCode}
            disabled={loading || phone.replace(/\D/g, '').length !== 10}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </div>
      )}

      {step === 'code' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enter Verification Code
            </label>
            <p className="text-sm text-gray-500 mb-4">
              We sent a 6-digit code to {phone}
            </p>

            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-12 h-14 text-center text-2xl font-semibold border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleVerifyCode()}
              disabled={loading || code.join('').length !== 6}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            <div className="flex justify-between text-sm">
              <button
                onClick={handleChangeNumber}
                className="text-gray-600 hover:text-gray-800"
                disabled={loading}
              >
                Change Number
              </button>
              <button
                onClick={handleResend}
                disabled={countdown > 0 || loading}
                className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'verified' && (
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Phone Verified!
            </h3>
            <p className="text-sm text-gray-500">
              {phone} has been verified for SMS notifications
            </p>
          </div>
          <button
            onClick={handleChangeNumber}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Use a different number
          </button>
        </div>
      )}
    </div>
  );
}
