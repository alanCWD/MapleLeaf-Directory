import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { submitPresenceCheckin, fetchStoreCheckins, fetchUserCheckins } from '../services/api';

interface PresenceCheckinProps {
  storeId: string;
  storeName: string;
}

interface CheckinResult {
  verified: boolean;
  distance: number;
  geoVerified: boolean;
  qrValid: boolean;
  checkinId: number | null;
}

interface CheckinStats {
  totalCheckins: number;
  verifiedCheckins: number;
}

export const PresenceCheckin: React.FC<PresenceCheckinProps> = ({ storeId, storeName }) => {
  const { user, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<'idle' | 'scanner' | 'manual'>('idle');
  const [manualCode, setManualCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [hasRecentCheckin, setHasRecentCheckin] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    fetchStoreCheckins(storeId)
      .then((data) => setStats({ totalCheckins: data.total, verifiedCheckins: data.verified }))
      .catch(() => setStats(null));

    if (isAuthenticated) {
      fetchUserCheckins()
        .then((checkins) => {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const hasRecent = checkins.some(
            (c) => c.storeId === storeId && c.geoVerified && new Date(c.verifiedAt) > oneHourAgo
          );
          setHasRecentCheckin(hasRecent);
        })
        .catch(() => setHasRecentCheckin(false));
    }
  }, [storeId, isAuthenticated]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    scannerRef.current = null;
  }, []);

  const startScanner = async () => {
    setMode('scanner');
    setError(null);
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        scannerRef.current = detector;
        scanFrame(detector);
      } else {
        setError('QR scanning not supported in this browser. Please enter the code manually.');
      }
    } catch (err: any) {
      setError('Could not access camera. Please enter the code manually.');
      setMode('manual');
    }
  };

  const scanFrame = (detector: any) => {
    if (!videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      detector.detect(video).then((barcodes: any[]) => {
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue;
          try {
            const payload = JSON.parse(raw);
            if (payload.code && payload.storeId) {
              stopScanner();
              handleCheckin(payload.code);
              return;
            }
          } catch {
            if (raw && raw.length > 10) {
              stopScanner();
              handleCheckin(raw);
              return;
            }
          }
        }
        animFrameRef.current = requestAnimationFrame(() => scanFrame(detector));
      }).catch(() => {
        animFrameRef.current = requestAnimationFrame(() => scanFrame(detector));
      });
    } else {
      animFrameRef.current = requestAnimationFrame(() => scanFrame(detector));
    }
  };

  const handleCheckin = async (code: string) => {
    if (!code.trim()) {
      setError('Please enter a valid code.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);
    setGeoStatus('requesting');

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      setGeoStatus('granted');
      const { latitude: lat, longitude: lng } = position.coords;

      const checkinResult = await submitPresenceCheckin(storeId, {
        qrCode: code.trim(),
        lat,
        lng,
      });

      setResult(checkinResult);

      if (checkinResult.verified) {
        setHasRecentCheckin(true);
        fetchStoreCheckins(storeId)
          .then((data) => setStats({ totalCheckins: data.total, verifiedCheckins: data.verified }))
          .catch(() => {});
      }

      setMode('idle');
    } catch (err: any) {
      if (err.code === 1) {
        setGeoStatus('denied');
        setError('Location access denied. Please enable location services to check in.');
      } else if (err.code === 2 || err.code === 3) {
        setGeoStatus('denied');
        setError('Could not determine your location. Please try again.');
      } else {
        setError(err.message || 'Check-in failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCheckin(manualCode);
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 text-center">
        <div className="text-2xl mb-2">📍</div>
        <p className="text-stone-600 text-sm font-medium">Sign in to check in at this store</p>
        {stats && stats.verifiedCheckins > 0 && (
          <p className="text-stone-400 text-xs mt-2">{stats.verifiedCheckins} verified check-ins</p>
        )}
      </div>
    );
  }

  if (hasRecentCheckin && !result) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-emerald-800">Verified Present</h4>
            <p className="text-emerald-600 text-xs">You have a recent verified check-in here</p>
          </div>
        </div>
        {stats && stats.verifiedCheckins > 0 && (
          <p className="text-emerald-500 text-xs mt-2">{stats.verifiedCheckins} total verified check-ins at this store</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-black text-stone-900 mb-4 uppercase tracking-wider flex items-center gap-2">
        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Check In
      </h3>

      {result && (
        <div className={`mb-4 p-4 rounded-xl ${result.verified ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {result.verified ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-emerald-800">Verified Check-in!</h4>
                <p className="text-emerald-600 text-sm">
                  {result.distance >= 0 ? `${Math.round(result.distance)}m from store` : 'Location verified'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-red-800">Check-in Not Verified</h4>
                <p className="text-red-600 text-sm">
                  {!result.qrValid && 'Invalid or expired QR code. '}
                  {!result.geoVerified && result.distance >= 0 && `Too far from store (${Math.round(result.distance)}m away). `}
                  {!result.geoVerified && result.distance < 0 && 'Could not verify location. '}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-amber-700 text-sm">{error}</p>
        </div>
      )}

      {mode === 'idle' && (
        <div className="space-y-3">
          <button
            onClick={startScanner}
            disabled={isSubmitting}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Scan QR Code
          </button>
          <button
            onClick={() => { setMode('manual'); setError(null); setResult(null); }}
            disabled={isSubmitting}
            className="w-full border-2 border-stone-200 text-stone-600 py-3 rounded-xl font-bold hover:border-emerald-500 hover:text-emerald-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Enter Code Manually
          </button>
        </div>
      )}

      {mode === 'scanner' && (
        <div className="space-y-3">
          <div className="relative bg-black rounded-xl overflow-hidden aspect-square max-h-[300px]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-emerald-400/70 rounded-2xl"></div>
            </div>
            {isSubmitting && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
              </div>
            )}
          </div>
          <p className="text-stone-500 text-xs text-center">Point your camera at the store's QR code</p>
          <div className="flex gap-2">
            <button
              onClick={() => { stopScanner(); setMode('manual'); }}
              className="flex-1 border border-stone-200 text-stone-600 py-2 rounded-xl text-sm font-bold hover:bg-stone-50 transition"
            >
              Enter Code Instead
            </button>
            <button
              onClick={() => { stopScanner(); setMode('idle'); }}
              className="flex-1 border border-stone-200 text-stone-600 py-2 rounded-xl text-sm font-bold hover:bg-stone-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">QR Code Value</label>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste or type the code shown at the store"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm"
              autoFocus
            />
          </div>
          {geoStatus === 'requesting' && (
            <p className="text-stone-400 text-xs flex items-center gap-1">
              <span className="animate-spin inline-block w-3 h-3 border border-stone-300 border-t-emerald-500 rounded-full"></span>
              Requesting location...
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !manualCode.trim()}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-500 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Verifying...' : 'Check In'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('idle'); setManualCode(''); setError(null); }}
              className="border border-stone-200 text-stone-600 px-4 py-3 rounded-xl font-bold hover:bg-stone-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {stats && stats.verifiedCheckins > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          <p className="text-stone-400 text-xs font-medium">
            {stats.verifiedCheckins} verified check-in{stats.verifiedCheckins !== 1 ? 's' : ''} at {storeName}
          </p>
        </div>
      )}
    </div>
  );
};
