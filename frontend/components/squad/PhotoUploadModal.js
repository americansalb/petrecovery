'use client';

import { useState, useRef } from 'react';
import { X, Upload, Camera } from 'lucide-react';

export default function PhotoUploadModal({ isOpen, onClose, onUpload, squadId }) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File must be less than 10MB');
      return;
    }

    setSelectedFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);

    try {
      // First, upload to bunny.net
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('context', 'general');

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const uploadData = await uploadResponse.json();

      // Then, update squad with new photo URL
      const updateResponse = await fetch(`/api/rescue-squads/${squadId}/photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoUrl: uploadData.url,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update squad photo');
      }

      // Callback to parent
      onUpload(uploadData.url);

      // Close modal
      onClose();

      // Reload page to show new photo
      window.location.reload();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-flash-500/30 rounded-2xl shadow-[0_0_60px_rgba(250,204,21,0.3)] max-w-md w-full p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Upload Squad Photo</h2>
          <p className="text-slate-400">Choose a photo to represent your rescue squad</p>
        </div>

        {/* Preview or Upload Area */}
        {preview ? (
          <div className="mb-6">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-64 object-cover rounded-xl border-2 border-slate-700/50"
            />
            <button
              onClick={() => {
                setPreview(null);
                setSelectedFile(null);
              }}
              className="mt-4 w-full px-4 py-2 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Choose Different Photo
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="mb-6 border-2 border-dashed border-slate-600 rounded-xl p-12 text-center cursor-pointer hover:border-flash-500/50 hover:bg-slate-800/30 transition-all"
          >
            <Camera size={48} className="mx-auto mb-4 text-slate-500" />
            <p className="text-slate-300 font-medium mb-1">Click to select photo</p>
            <p className="text-sm text-slate-500">PNG, JPG, WebP up to 10MB</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-flash-500 to-flash-400 text-midnight-900 font-bold shadow-lg shadow-flash-500/30 hover:shadow-xl hover:shadow-flash-500/50 hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Uploading...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Upload size={20} />
              <span>Upload Photo</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
