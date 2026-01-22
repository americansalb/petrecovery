'use client';

/**
 * CreatePostModal - Beautiful modal for creating posts
 * Supports text, images, and rich formatting
 */

import { useState, useRef } from 'react';
import { X, Image as ImageIcon, Upload, AlertCircle } from 'lucide-react';

export default function CreatePostModal({ isOpen, onClose, onSubmit, forceId, divisionId = null }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('File must be an image');
      return;
    }

    setImageFile(file);
    setError('');

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Post content is required');
      return;
    }

    setUploading(true);
    setError('');

    try {
      let imageUrl = null;

      // Upload image if selected
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('context', 'general');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload image');
        }

        const uploadData = await uploadRes.json();
        imageUrl = uploadData.url;
      }

      // Create post
      const res = await fetch(`/api/rescue-forces/${forceId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          content: content.trim(),
          imageUrl,
          divisionId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create post');
      }

      const data = await res.json();

      // Reset form
      setTitle('');
      setContent('');
      setImageFile(null);
      setImagePreview(null);

      onSubmit(data.post);
      onClose();
    } catch (err) {
      console.error('Error creating post:', err);
      setError(err.message || 'Failed to create post. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setTitle('');
      setContent('');
      setImageFile(null);
      setImagePreview(null);
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-flash-500/30 rounded-2xl shadow-[0_0_60px_rgba(250,204,21,0.3)] max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 to-slate-800 border-b-2 border-slate-700/60 px-8 py-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Create Post</h2>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-all disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Title <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your post a title..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-600 text-white placeholder-slate-500 font-medium focus:outline-none focus:border-flash-500 focus:ring-2 focus:ring-flash-500/30 transition-all"
              maxLength={200}
              style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
            />
          </div>

          {/* Content Textarea */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Content <span className="text-red-400">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              rows={8}
              className="w-full px-4 py-3 rounded-xl bg-slate-700 border-2 border-slate-600 text-white placeholder-slate-400 font-medium focus:outline-none focus:border-flash-500 focus:ring-2 focus:ring-flash-500/30 transition-all resize-none"
              style={{ backgroundColor: '#334155', color: '#ffffff' }}
              maxLength={5000}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-slate-500">
                Supports line breaks. Be respectful and constructive.
              </p>
              <p className="text-xs text-slate-400">
                {content.length}/5000
              </p>
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Image <span className="text-slate-500">(optional, max 5MB)</span>
            </label>

            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-slate-700/50">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-96 object-cover"
                />
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 px-6 rounded-xl border-2 border-dashed border-slate-600/50 hover:border-flash-500/50 bg-slate-800/30 hover:bg-slate-800/50 transition-all group"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 rounded-full bg-slate-700/50 group-hover:bg-flash-500/20 transition-all">
                    <ImageIcon size={32} className="text-slate-400 group-hover:text-flash-400 transition-colors" />
                  </div>
                  <div>
                    <p className="text-white font-semibold mb-1">Click to upload image</p>
                    <p className="text-sm text-slate-400">PNG, JPG, GIF up to 5MB</p>
                  </div>
                </div>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gradient-to-r from-slate-900 to-slate-800 border-t-2 border-slate-700/60 px-8 py-6 flex items-center justify-end gap-4">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-6 py-3 rounded-xl bg-slate-700/50 text-white font-semibold hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || uploading}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-flash-500 to-flash-400 text-white font-bold shadow-lg shadow-flash-500/30 hover:shadow-xl hover:shadow-flash-500/50 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <Upload size={20} />
                <span>Post</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
