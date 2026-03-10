import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { fetchPresenceQR } from '../services/api';

interface PresenceQRProps {
  storeId: string;
  storeName: string;
}

export const PresenceQR: React.FC<PresenceQRProps> = ({ storeId, storeName }) => {
  const [qrPayload, setQrPayload] = useState<{ code: string; expiresAt: string; storeId: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQR = useCallback(async () => {
    try {
      setError('');
      const payload = await fetchPresenceQR(storeId);
      setQrPayload(payload);

      const qrData = JSON.stringify({ code: payload.code, storeId: payload.storeId });
      const dataUrl = await QRCode.toDataURL(qrData, {
        width: 400,
        margin: 2,
        color: { dark: '#1a1a1a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
      setQrDataUrl(dataUrl);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load QR code');
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchQR();
  }, [fetchQR]);

  useEffect(() => {
    if (!qrPayload) return;

    const updateCountdown = () => {
      const now = Date.now();
      const expiresAt = new Date(qrPayload.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        fetchQR();
      }
    };

    updateCountdown();
    timerRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [qrPayload, fetchQR]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-8">
        <button
          onClick={() => setFullScreen(false)}
          className="absolute top-6 right-6 bg-stone-100 hover:bg-stone-200 text-stone-600 p-3 rounded-full transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-2xl font-black text-stone-900 mb-2">{storeName}</h2>
        <p className="text-stone-500 font-medium mb-8">Scan to check in</p>
        {qrDataUrl && (
          <img src={qrDataUrl} alt="Presence QR Code" className="w-80 h-80 md:w-96 md:h-96" />
        )}
        <div className="mt-8 text-center">
          <div className={`text-4xl font-black tabular-nums ${secondsLeft <= 30 ? 'text-red-500' : 'text-emerald-600'}`}>
            {formatTime(secondsLeft)}
          </div>
          <p className="text-stone-400 text-sm font-medium mt-1">until next rotation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-stone-200 rounded-2xl p-6 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-stone-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          Presence QR Code
        </h4>
        {qrDataUrl && (
          <button
            onClick={() => setFullScreen(true)}
            className="text-sm font-bold text-emerald-600 hover:text-emerald-500 transition flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Full Screen
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <svg className="w-6 h-6 animate-spin text-stone-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-sm text-red-500 font-medium mb-3">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchQR(); }}
            className="text-sm font-bold text-emerald-600 hover:text-emerald-500 transition"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <p className="text-stone-500 text-sm font-medium mb-4 text-center">
            Display this QR code at your store for customer check-ins
          </p>
          {qrDataUrl && (
            <img src={qrDataUrl} alt="Presence QR Code" className="w-48 h-48 mb-4" />
          )}
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${secondsLeft <= 30 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className={`text-lg font-black tabular-nums ${secondsLeft <= 30 ? 'text-red-500' : 'text-stone-900'}`}>
              {formatTime(secondsLeft)}
            </span>
          </div>
          <p className="text-stone-400 text-xs font-medium">until next rotation</p>
        </div>
      )}
    </div>
  );
};
