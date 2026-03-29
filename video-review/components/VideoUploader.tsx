import React, { useState, useRef, useCallback } from 'react';
import * as tus from 'tus-js-client';
import type { VideoMediaType } from '../types.ts';
import { initMediaUpload } from '../client/api.ts';

type UploadState = 'selecting' | 'uploading' | 'processing' | 'ready' | 'error';

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const ACCEPTED_EXTENSIONS = '.mp4,.mov,.webm,.avi';
const MAX_FILE_SIZE = 500 * 1024 * 1024;

interface VideoUploaderProps {
  storeId: string;
  onComplete?: (mediaId: number) => void;
  onCancel?: () => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ storeId, onComplete, onCancel }) => {
  const [state, setState] = useState<UploadState>('selecting');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [mediaType, setMediaType] = useState<VideoMediaType>('review');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<tus.Upload | null>(null);

  const validateFile = (f: File): string | null => {
    if (f.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is 500MB (yours: ${(f.size / (1024 * 1024)).toFixed(1)}MB).`;
    }
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(mp4|mov|webm|avi)$/i)) {
      return 'Unsupported file type. Please use MP4, MOV, WebM, or AVI.';
    }
    return null;
  };

  const handleFile = (f: File) => {
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFile(f);
    setError('');
    if (!title) {
      setTitle(f.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [title]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  };

  const startUpload = async () => {
    if (!file || !title.trim()) {
      setError('Please provide a title and select a file.');
      return;
    }

    setState('uploading');
    setProgress(0);
    setError('');

    try {
      const creds = await initMediaUpload(storeId, title.trim(), mediaType);

      const upload = new tus.Upload(file, {
        endpoint: `https://video.bunnycdn.com/tusupload`,
        retryDelays: [0, 1000, 3000, 5000],
        metadata: {
          filetype: file.type,
          title: title.trim(),
        },
        headers: {
          AuthorizationSignature: creds.signature,
          AuthorizationExpire: String(creds.expirationTime),
          VideoId: creds.videoId,
          LibraryId: String(creds.libraryId),
        },
        onError: (err) => {
          console.error('TUS upload error:', err);
          setError(err.message || 'Upload failed. Please try again.');
          setState('error');
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = Math.round((bytesUploaded / bytesTotal) * 100);
          setProgress(pct);
        },
        onSuccess: () => {
          setState('processing');
          setTimeout(() => {
            setState('ready');
            onComplete?.(creds.mediaId);
          }, 2000);
        },
      });

      uploadRef.current = upload;
      upload.start();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize upload.');
      setState('error');
    }
  };

  const handleRetry = () => {
    setError('');
    setState('selecting');
    setProgress(0);
  };

  const handleCancel = () => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    onCancel?.();
  };

  if (state === 'ready') {
    return (
      <div className="bg-white rounded-[32px] border border-stone-200 p-8 md:p-12 shadow-sm text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-black text-stone-900 mb-3">Upload Complete</h3>
        <p className="text-stone-500 font-medium mb-8">
          Your video has been uploaded and is being processed. It will appear on the store page shortly.
        </p>
        <button
          onClick={handleCancel}
          className="bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition shadow-lg shadow-emerald-200"
        >
          Done
        </button>
      </div>
    );
  }

  if (state === 'processing') {
    return (
      <div className="bg-white rounded-[32px] border border-stone-200 p-8 md:p-12 shadow-sm text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h3 className="text-2xl font-black text-stone-900 mb-3">Processing Video</h3>
        <p className="text-stone-500 font-medium">
          Your video is being encoded. This may take a few minutes.
        </p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="bg-white rounded-[32px] border border-stone-200 p-8 md:p-12 shadow-sm text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-2xl font-black text-stone-900 mb-3">Upload Failed</h3>
        <p className="text-red-600 font-medium mb-8">{error}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleRetry}
            className="bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition shadow-lg shadow-emerald-200"
          >
            Try Again
          </button>
          <button
            onClick={handleCancel}
            className="bg-stone-100 text-stone-700 px-8 py-3 rounded-2xl font-bold hover:bg-stone-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state === 'uploading') {
    return (
      <div className="bg-white rounded-[32px] border border-stone-200 p-8 md:p-12 shadow-sm">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-black text-stone-900 mb-2">Uploading Video</h3>
          <p className="text-stone-500 font-medium">{file?.name}</p>
        </div>
        <div className="mb-6">
          <div className="flex justify-between text-sm font-bold mb-2">
            <span className="text-stone-500">Progress</span>
            <span className="text-emerald-600">{progress}%</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-4 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-stone-400 text-center font-medium">
          {progress < 100 ? 'Please keep this page open until upload completes.' : 'Finalizing...'}
        </p>
        <button
          onClick={handleCancel}
          className="mt-6 w-full bg-stone-100 text-stone-700 py-3 rounded-2xl font-bold hover:bg-stone-200 transition"
        >
          Cancel Upload
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[32px] border border-stone-200 p-8 md:p-12 shadow-sm">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-black text-stone-900 mb-2">Upload Video</h3>
        <p className="text-stone-500 font-medium">
          Share pre-recorded content for this store
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-emerald-400 bg-emerald-50'
            : file
            ? 'border-emerald-300 bg-emerald-50/50'
            : 'border-stone-200 bg-stone-50 hover:border-emerald-300 hover:bg-emerald-50/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileInput}
          className="hidden"
        />
        {file ? (
          <div>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="font-bold text-stone-900 mb-1">{file.name}</p>
            <p className="text-sm text-stone-500">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
            <p className="text-xs text-emerald-600 font-bold mt-2">Click to change file</p>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="font-bold text-stone-700 mb-1">Drag & drop your video here</p>
            <p className="text-sm text-stone-400">or click to browse</p>
            <p className="text-xs text-stone-400 mt-3">MP4, MOV, WebM, AVI — 500MB max</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Title *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Store walkthrough, Product showcase"
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Type</label>
          <select
            value={mediaType}
            onChange={e => setMediaType(e.target.value as VideoMediaType)}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 outline-none text-stone-900 font-medium"
          >
            <option value="video">Video</option>
            <option value="walkthrough">Walkthrough</option>
            <option value="review">Review</option>
          </select>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={startUpload}
          disabled={!file || !title.trim()}
          className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-400 transition shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Upload Video
        </button>
        {onCancel && (
          <button
            onClick={handleCancel}
            className="bg-stone-100 text-stone-700 px-6 py-4 rounded-2xl font-bold hover:bg-stone-200 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
