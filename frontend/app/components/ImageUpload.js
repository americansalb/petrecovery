'use client';

/**
 * ImageUpload Component - Phase 1.1
 *
 * Reusable image upload component with:
 * - Drag and drop support
 * - Image preview
 * - Upload progress
 * - Multiple image support
 * - File validation
 */

import { useState, useRef, useCallback } from 'react';

export default function ImageUpload({
  onUpload,
  onRemove,
  images = [],
  maxImages = 5,
  context = 'general',
  disabled = false,
  label = 'Upload Photos',
  helpText = 'Drag and drop images here, or click to browse',
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFiles = useCallback(async (files) => {
    if (disabled) return;

    setError(null);
    const fileList = Array.from(files);

    // Check max images limit
    if (images.length + fileList.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    // Validate files
    const validFiles = [];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    for (const file of fileList) {
      if (!allowedTypes.includes(file.type)) {
        setError(`Invalid file type: ${file.name}. Only JPEG, PNG, WebP, and GIF allowed.`);
        continue;
      }
      if (file.size > maxSize) {
        setError(`File too large: ${file.name}. Maximum 10MB per image.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Upload each file
    setUploading(true);
    setUploadProgress(0);

    const uploadedImages = [];
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setUploadProgress(Math.round((i / validFiles.length) * 100));

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('context', context);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }

        const data = await response.json();
        uploadedImages.push({
          url: data.url,
          filename: data.filename,
          originalName: file.name,
        });
      } catch (err) {
        console.error(`[IMAGE-UPLOAD] Upload error: ${err.message}`);
        setError(`Failed to upload ${file.name}: ${err.message}`);
      }
    }

    setUploading(false);
    setUploadProgress(100);

    if (uploadedImages.length > 0 && onUpload) {
      onUpload(uploadedImages);
    }
  }, [disabled, images.length, maxImages, context, onUpload]);

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!disabled && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Click to browse
  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // Remove image
  const handleRemove = async (index) => {
    if (disabled) return;

    const image = images[index];
    // Optionally delete from server
    if (image.filename) {
      try {
        await fetch(`/api/upload?filename=${encodeURIComponent(image.filename)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('[IMAGE-UPLOAD] Delete error:', err);
        // Continue with local removal even if server delete fails
      }
    }

    if (onRemove) {
      onRemove(index);
    }
  };

  const remainingSlots = maxImages - images.length;

  return (
    <div className="image-upload-container">
      {/* Label */}
      <label style={{
        display: 'block',
        marginBottom: '0.5rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#374151',
      }}>
        {label}
        {maxImages > 1 && (
          <span style={{ fontWeight: '400', color: '#6b7280' }}>
            {' '}({images.length}/{maxImages})
          </span>
        )}
      </label>

      {/* Image previews */}
      {images.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}>
          {images.map((image, index) => (
            <div
              key={index}
              style={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                border: '2px solid #e5e7eb',
                background: '#f9fafb',
              }}
            >
              <img
                src={image.url}
                alt={image.originalName || `Image ${index + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'rgba(220, 38, 38, 0.9)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                  title="Remove image"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {remainingSlots > 0 && (
        <div
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? '#2563eb' : disabled ? '#d1d5db' : '#9ca3af'}`,
            borderRadius: '0.75rem',
            padding: '2rem',
            textAlign: 'center',
            background: isDragging ? '#eff6ff' : disabled ? '#f9fafb' : 'white',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple={maxImages > 1}
            onChange={handleFileChange}
            disabled={disabled}
            style={{ display: 'none' }}
          />

          {uploading ? (
            <div>
              <div style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 1rem',
                border: '4px solid #e5e7eb',
                borderTopColor: '#2563eb',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <p style={{ color: '#6b7280', marginBottom: '0.5rem' }}>
                Uploading... {uploadProgress}%
              </p>
            </div>
          ) : (
            <>
              <div style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 1rem',
                background: '#f3f4f6',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
              }}>
                📷
              </div>
              <p style={{
                color: isDragging ? '#2563eb' : '#374151',
                fontWeight: '500',
                marginBottom: '0.5rem',
              }}>
                {isDragging ? 'Drop images here' : helpText}
              </p>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                JPEG, PNG, WebP, or GIF • Max 10MB each
              </p>
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p style={{
          marginTop: '0.5rem',
          color: '#dc2626',
          fontSize: '0.875rem',
        }}>
          ⚠️ {error}
        </p>
      )}

      {/* CSS for spin animation */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
