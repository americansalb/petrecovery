'use client';

/**
 * PhotoStep — branded photo uploader for the report wizards.
 *
 * Posts to /api/upload (Bunny CDN URLs — never base64). The first successful
 * upload fires /api/ai/analyze-pet best-effort and hands the result to
 * onAnalysis so the Colors step can open pre-filled; analysis never blocks
 * progression and fails silently.
 */

import { useState, useRef } from 'react';
import { Camera, Loader2, X, Check, Sparkles, ImagePlus } from 'lucide-react';
import { WIZARD_THEMES } from './wizardTheme';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default function PhotoStep({
  photos = [], // array of CDN URLs
  displayIndex = 0,
  onPhotosChange,
  onDisplayChange,
  onAnalysis, // ({ species, colors }) — best-effort AI prefill
  maxPhotos = 5,
  variant = 'lost',
  petName,
}) {
  const theme = WIZARD_THEMES[variant];
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const analyzedRef = useRef(false);

  const analyzePhoto = async (url) => {
    if (analyzedRef.current || !onAnalysis) return;
    analyzedRef.current = true;
    setAnalyzing(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('/api/ai/analyze-pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const analysis = await res.json();
        setAnalyzed(true);
        onAnalysis(analysis);
      }
    } catch {
      /* best-effort only — never surface AI failures */
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, maxPhotos - photos.length);
    if (!files.length) return;
    setError(null);
    setUploading(true);

    const uploaded = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} isn't an image.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError('Each photo must be under 10MB.');
        continue;
      }
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('context', 'pet');
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Upload failed');
        }
        const data = await response.json();
        if (data.url) uploaded.push(data.url);
      } catch (err) {
        setError(`Couldn't upload ${file.name}: ${err.message}`);
      }
    }
    setUploading(false);

    if (uploaded.length) {
      const wasEmpty = photos.length === 0;
      onPhotosChange([...photos, ...uploaded]);
      if (wasEmpty) analyzePhoto(uploaded[0]);
    }
  };

  const removePhoto = (index) => {
    const next = photos.filter((_, i) => i !== index);
    onPhotosChange(next);
    if (onDisplayChange) {
      if (displayIndex >= next.length) onDisplayChange(Math.max(0, next.length - 1));
      else if (index < displayIndex) onDisplayChange(displayIndex - 1);
    }
  };

  const inputProps = {
    type: 'file',
    accept: 'image/*',
    multiple: maxPhotos > 1,
    className: 'hidden',
    disabled: uploading,
    onChange: (e) => {
      handleFiles(e.target.files);
      e.target.value = '';
    },
  };

  return (
    <div>
      {photos.length === 0 ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`block aspect-[4/3] max-w-md rounded-3xl border-2 border-dashed cursor-pointer transition-all ${
            dragging
              ? `${theme.softBg} ${theme.softBorder}`
              : 'border-midnight-200 bg-midnight-50/50 hover:border-midnight-400 hover:bg-white'
          }`}
        >
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            {uploading ? (
              <>
                <Loader2 size={38} className="text-midnight-400 animate-spin mb-3" />
                <p className="text-midnight-500 font-medium">Uploading…</p>
              </>
            ) : (
              <>
                <span className="w-16 h-16 rounded-full bg-flash-100 flex items-center justify-center mb-4">
                  <Camera size={28} className="text-flash-600" />
                </span>
                <p className="font-bold text-midnight-900 text-lg">
                  Tap to add {petName ? `a photo of ${petName}` : 'a photo'}
                </p>
                <p className="text-sm text-midnight-400 mt-1">or drag &amp; drop · JPEG, PNG · up to 10MB</p>
              </>
            )}
          </div>
          <input {...inputProps} />
        </label>
      ) : (
        <div>
          {/* Display photo */}
          <div className="relative max-w-md rounded-3xl overflow-hidden shadow-card-hover">
            <img
              src={photos[displayIndex] || photos[0]}
              alt={petName ? `Photo of ${petName}` : 'Pet photo'}
              className="w-full aspect-[4/3] object-cover"
            />
            <span className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-flash-400 text-midnight-900 text-xs font-bold flex items-center gap-1.5">
              <Check size={12} strokeWidth={3} /> Main photo
            </span>
          </div>

          {/* Thumbnails + add */}
          <div className="flex flex-wrap gap-3 mt-4">
            {photos.map((url, i) => (
              <div key={url + i} className="relative group">
                <button
                  type="button"
                  onClick={() => onDisplayChange && onDisplayChange(i)}
                  aria-label={`Use photo ${i + 1} as the main photo`}
                  className={`w-[72px] h-[72px] rounded-xl overflow-hidden border-2 transition-all ${
                    i === displayIndex ? 'border-flash-400 shadow-card' : 'border-midnight-100 hover:border-midnight-300'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-midnight-900 text-white flex items-center justify-center shadow opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {photos.length < maxPhotos && (
              <label className="w-[72px] h-[72px] rounded-xl border-2 border-dashed border-midnight-200 flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:border-midnight-400 hover:bg-midnight-50 transition-all">
                {uploading ? (
                  <Loader2 size={18} className="text-midnight-400 animate-spin" />
                ) : (
                  <>
                    <ImagePlus size={18} className="text-midnight-400" />
                    <span className="text-[0.65rem] font-medium text-midnight-400">Add</span>
                  </>
                )}
                <input {...inputProps} />
              </label>
            )}
          </div>

          {photos.length > 1 && (
            <p className="text-xs text-midnight-400 mt-2">Tap a thumbnail to make it the main photo.</p>
          )}
        </div>
      )}

      {/* AI hint */}
      {analyzing && (
        <p className="flex items-center gap-2 mt-4 text-sm text-midnight-500">
          <Loader2 size={15} className="animate-spin" />
          Reading colors from the photo…
        </p>
      )}
      {analyzed && !analyzing && (
        <p className={`flex items-center gap-2 mt-4 text-sm font-medium ${theme.accentText}`}>
          <Sparkles size={15} />
          Got it — we&apos;ll suggest colors on the next step.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
