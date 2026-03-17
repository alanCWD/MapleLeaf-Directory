import React, { useState, useRef, useEffect, useCallback } from 'react';
import { fetchRecorderQuestions, initMediaUpload, submitReview, stitchVideoClips } from '../services/api';
import type { RecorderQuestion, WeightedReview } from '../services/api';
import * as tus from 'tus-js-client';

interface VideoRecorderProps {
  storeId: string;
  storeName: string;
  storeType: string;
  onComplete: (review: WeightedReview) => void;
  onCancel: () => void;
}

type Step = 'welcome' | 'recording' | 'review' | 'uploading';
type StitchPhase = 'uploading' | 'stitching' | 'processing' | 'submitting' | 'done';
type CameraFacing = 'user' | 'environment';

interface RecordedClip {
  questionId: string;
  blob: Blob;
  url: string;
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({
  storeId,
  storeName,
  storeType,
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState<Step>('welcome');
  const [questions, setQuestions] = useState<RecorderQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [recordedClips, setRecordedClips] = useState<RecordedClip[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('user');
  const [rating, setRating] = useState(5);
  const [commentText, setCommentText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [stitchPhase, setStitchPhase] = useState<StitchPhase>('uploading');
  const [trustWeightEarned, setTrustWeightEarned] = useState(0);
  const [completedReview, setCompletedReview] = useState<WeightedReview | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLoadingQuestions(true);
    fetchRecorderQuestions(storeId)
      .then(setQuestions)
      .catch(() => {
        setQuestions([
          { id: 'q1', prompt: 'What brought you here today?', maxDurationSeconds: 60, isRequired: true },
          { id: 'q2', prompt: 'What makes this spot special?', maxDurationSeconds: 60, isRequired: false },
          { id: 'q3', prompt: 'Would you recommend this place?', maxDurationSeconds: 30, isRequired: false },
        ]);
      })
      .finally(() => setLoadingQuestions(false));
  }, [storeId]);

  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      recordedClips.forEach(clip => URL.revokeObjectURL(clip.url));
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  useEffect(() => {
    if (step === 'recording' && streamRef.current && videoRef.current && !previewUrl) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [step]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: CameraFacing = cameraFacing) => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
      setPermissionDenied(false);
      return true;
    } catch {
      setPermissionDenied(true);
      return false;
    }
  }, [cameraFacing, stopStream]);

  const toggleCamera = useCallback(async () => {
    const newFacing: CameraFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(newFacing);
    if (streamRef.current && !isRecording) {
      await startCamera(newFacing);
    }
  }, [cameraFacing, isRecording, startCamera]);

  const handleStart = async () => {
    const ok = await startCamera();
    if (ok) {
      setStep('recording');
      setCurrentQuestionIndex(0);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const baseMimeType = mimeType.split(';')[0].trim();
      const blob = new Blob(chunksRef.current, { type: baseMimeType });
      const url = URL.createObjectURL(blob);
      const question = questions[currentQuestionIndex];

      const existing = recordedClips.findIndex(c => c.questionId === question.id);
      setRecordedClips(prev => {
        const updated = [...prev];
        if (existing >= 0) {
          URL.revokeObjectURL(updated[existing].url);
          updated[existing] = { questionId: question.id, blob, url };
        } else {
          updated.push({ questionId: question.id, blob, url });
        }
        return updated;
      });

      setPreviewUrl(url);
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };

    recorder.start(1000);
    setIsRecording(true);
    setIsPaused(false);
    setElapsed(0);
    setPreviewUrl(null);

    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        const maxDur = questions[currentQuestionIndex]?.maxDurationSeconds || 60;
        if (next >= maxDur) {
          mediaRecorderRef.current?.stop();
          if (timerRef.current) clearInterval(timerRef.current);
        }
        return next;
      });
    }, 1000);
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          const maxDur = questions[currentQuestionIndex]?.maxDurationSeconds || 60;
          if (next >= maxDur) {
            mediaRecorderRef.current?.stop();
            if (timerRef.current) clearInterval(timerRef.current);
          }
          return next;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const reRecordCurrent = () => {
    setPreviewUrl(null);
    setElapsed(0);
  };

  const goToNextQuestion = () => {
    setPreviewUrl(null);
    setElapsed(0);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      stopStream();
      setStep('review');
    }
  };

  const skipQuestion = () => {
    setPreviewUrl(null);
    setElapsed(0);
    if (isRecording) stopRecording();
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      stopStream();
      setStep('review');
    }
  };

  const goToReview = () => {
    stopStream();
    setStep('review');
  };

  const reRecordClip = (index: number) => {
    const clip = recordedClips[index];
    const qIdx = questions.findIndex(q => q.id === clip.questionId);
    if (qIdx >= 0) {
      setCurrentQuestionIndex(qIdx);
      setPreviewUrl(null);
      setElapsed(0);
      setStep('recording');
      startCamera();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (recordedClips.length === 0) return;

    setStep('uploading');
    setUploadProgress(0);
    setUploadError('');
    setStitchPhase('uploading');

    try {
      const useStitching = recordedClips.length > 1;
      let mediaId: number;

      if (useStitching) {
        setStitchPhase('uploading');
        setUploadProgress(10);

        const clipsForApi = recordedClips.map(c => ({
          blob: c.blob,
          questionId: c.questionId,
        }));

        const questionsForApi = questions.map(q => ({
          id: q.id,
          prompt: q.prompt,
        }));

        setStitchPhase('stitching');
        setUploadProgress(30);

        const stitchResult = await stitchVideoClips(
          storeId,
          clipsForApi,
          questionsForApi,
          storeName,
          `Video Review - ${storeName}`
        );

        setStitchPhase('processing');
        setUploadProgress(80);

        mediaId = stitchResult.mediaId;
      } else {
        const singleBlob = recordedClips[0].blob;
        const creds = await initMediaUpload(storeId, `Video Review - ${storeName}`, 'review');
        setUploadProgress(10);

        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(singleBlob, {
            endpoint: `https://video.bunnycdn.com/tusupload`,
            retryDelays: [0, 3000, 5000, 10000],
            headers: {
              AuthorizationSignature: creds.signature,
              AuthorizationExpire: creds.expirationTime.toString(),
              VideoId: creds.videoId,
              LibraryId: creds.libraryId.toString(),
            },
            metadata: {
              filetype: 'video/webm',
              title: `Video Review - ${storeName}`,
            },
            onError: (error) => reject(error),
            onProgress: (bytesUploaded, bytesTotal) => {
              const pct = 10 + Math.round((bytesUploaded / bytesTotal) * 70);
              setUploadProgress(pct);
            },
            onSuccess: () => {
              setUploadProgress(85);
              resolve();
            },
          });
          upload.start();
        });

        mediaId = creds.mediaId;
      }

      setStitchPhase('submitting');
      setUploadProgress(90);

      const review = await submitReview(storeId, {
        rating,
        contentText: commentText || `Video review of ${storeName}`,
        videoAssetId: mediaId,
      });

      setUploadProgress(100);
      setStitchPhase('done');
      setTrustWeightEarned(review.trustWeight?.final ?? 0);
      setCompletedReview(review);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Please try again.');
    }
  };

  const handleFileUploadFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setRecordedClips([{ questionId: 'file-upload', blob: file, url }]);
    setStep('review');
  };

  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900/80 flex items-center justify-center p-4">
        <div className="bg-white rounded-[32px] max-w-lg w-full p-8 md:p-12 text-center shadow-2xl relative">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-stone-900 mb-3 tracking-tight">
            Share Your Experience
          </h2>
          <p className="text-stone-500 font-medium mb-2">at</p>
          <p className="text-xl font-bold text-emerald-600 mb-6">{storeName}</p>

          <p className="text-stone-500 text-sm mb-8 leading-relaxed">
            We'll guide you through a few quick questions. Record short video answers using your camera.
            Video reviews earn higher trust weight in our integrity system.
          </p>

          {loadingQuestions ? (
            <div className="flex items-center justify-center gap-2 text-stone-400 mb-6">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading questions...
            </div>
          ) : (
            <>
              <button
                onClick={handleStart}
                className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-400 transition shadow-lg shadow-emerald-200 mb-3"
              >
                Start Recording
              </button>

              {permissionDenied && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
                  <p className="text-amber-700 text-sm font-medium mb-2">
                    Camera access was denied. You can upload a video file instead.
                  </p>
                  <label className="inline-block bg-amber-500 text-white px-6 py-2 rounded-xl font-bold cursor-pointer hover:bg-amber-400 transition text-sm">
                    Upload Video File
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleFileUploadFallback}
                    />
                  </label>
                </div>
              )}

              <button
                onClick={onCancel}
                className="text-stone-400 hover:text-stone-600 font-medium text-sm transition"
              >
                Maybe later
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (step === 'recording') {
    const currentQuestion = questions[currentQuestionIndex];
    const maxDur = currentQuestion?.maxDurationSeconds || 60;
    const hasClipForCurrent = recordedClips.some(c => c.questionId === currentQuestion?.id);

    return (
      <div className="fixed inset-0 z-50 bg-stone-900 flex flex-col">
        <div className="flex items-center justify-between p-4 bg-stone-900/90 z-10">
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-xs font-bold uppercase tracking-widest">
              Question {currentQuestionIndex + 1} / {questions.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!isRecording && (
              <button
                onClick={toggleCamera}
                className="text-white/70 hover:text-white transition p-2"
                title="Switch camera"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            <button
              onClick={() => {
                if (isRecording) stopRecording();
                stopStream();
                onCancel();
              }}
              className="text-white/70 hover:text-white transition p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          {previewUrl ? (
            <video
              ref={previewVideoRef}
              src={previewUrl}
              controls
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
          )}

          <div className="absolute top-4 left-4 right-4">
            <div className="bg-stone-900/70 backdrop-blur-sm rounded-2xl p-4">
              <p className="text-white font-bold text-lg leading-snug">
                {currentQuestion?.prompt}
              </p>
            </div>
          </div>

          {isRecording && (
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-full text-sm font-bold">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                {formatTime(elapsed)} / {formatTime(maxDur)}
              </div>
            </div>
          )}

          {!isRecording && !previewUrl && elapsed === 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-stone-900/80 to-transparent p-8">
              <div className="w-full bg-stone-700/50 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${((currentQuestionIndex) / questions.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-stone-900/90 space-y-3">
          {previewUrl ? (
            <div className="flex gap-3">
              <button
                onClick={reRecordCurrent}
                className="flex-1 bg-stone-700 text-white py-3.5 rounded-2xl font-bold hover:bg-stone-600 transition"
              >
                Re-record
              </button>
              <button
                onClick={goToNextQuestion}
                className="flex-1 bg-emerald-500 text-white py-3.5 rounded-2xl font-bold hover:bg-emerald-400 transition"
              >
                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Review & Submit'}
              </button>
            </div>
          ) : isRecording ? (
            <div className="flex gap-3">
              {isPaused ? (
                <button
                  onClick={resumeRecording}
                  className="flex-1 bg-emerald-500 text-white py-3.5 rounded-2xl font-bold hover:bg-emerald-400 transition"
                >
                  Resume
                </button>
              ) : (
                <button
                  onClick={pauseRecording}
                  className="flex-1 bg-amber-500 text-white py-3.5 rounded-2xl font-bold hover:bg-amber-400 transition"
                >
                  Pause
                </button>
              )}
              <button
                onClick={stopRecording}
                className="flex-1 bg-red-500 text-white py-3.5 rounded-2xl font-bold hover:bg-red-400 transition"
              >
                Stop
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={startRecording}
                className="flex-1 bg-red-500 text-white py-3.5 rounded-2xl font-bold hover:bg-red-400 transition flex items-center justify-center gap-2"
              >
                <span className="w-3 h-3 bg-white rounded-full" />
                Record
              </button>
              {!currentQuestion?.isRequired && (
                <button
                  onClick={skipQuestion}
                  className="bg-stone-700 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-stone-600 transition"
                >
                  Skip
                </button>
              )}
              {hasClipForCurrent && (
                <button
                  onClick={goToNextQuestion}
                  className="bg-emerald-500 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-emerald-400 transition"
                >
                  Next
                </button>
              )}
              {recordedClips.length > 0 && currentQuestionIndex > 0 && (
                <button
                  onClick={goToReview}
                  className="bg-stone-700 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-stone-600 transition text-sm"
                >
                  Done
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900/80 flex items-center justify-center p-4">
        <div className="bg-white rounded-[32px] max-w-lg w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl relative">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="text-2xl font-black text-stone-900 mb-6 tracking-tight">Review & Submit</h2>

          <div className="space-y-4 mb-8">
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest">Your Clips</h3>
            {recordedClips.length === 0 ? (
              <p className="text-stone-400 italic text-sm">No clips recorded yet.</p>
            ) : (
              recordedClips.map((clip, idx) => {
                const q = questions.find(q => q.id === clip.questionId);
                return (
                  <div key={clip.questionId} className="bg-stone-50 rounded-2xl p-4 flex items-center gap-4">
                    <video
                      src={clip.url}
                      className="w-20 h-14 object-cover rounded-lg bg-stone-200"
                      muted
                      playsInline
                      onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                      onMouseLeave={e => {
                        const v = e.target as HTMLVideoElement;
                        v.pause();
                        v.currentTime = 0;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-800 truncate">
                        {q?.prompt || `Clip ${idx + 1}`}
                      </p>
                      <p className="text-xs text-stone-400">
                        {(clip.blob.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => reRecordClip(idx)}
                      className="text-emerald-600 hover:text-emerald-500 text-xs font-bold whitespace-nowrap"
                    >
                      Re-record
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest mb-3">Your Rating</h3>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-3xl transition-transform hover:scale-125 ${star <= rating ? 'text-amber-400' : 'text-stone-200'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest mb-3">
              Comment <span className="text-stone-300 font-normal">(optional)</span>
            </h3>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a written comment to go with your video..."
              rows={3}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium resize-none"
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Video reviews earn +0.2 trust weight bonus
            </div>
            {recordedClips.length > 1 && (
              <p className="text-emerald-600 text-xs mt-2">
                Your {recordedClips.length} clips will be auto-stitched into a single polished video with title cards and smooth transitions.
              </p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={recordedClips.length === 0}
            className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-400 transition shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Video Review
          </button>
        </div>
      </div>
    );
  }

  if (step === 'uploading') {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900/80 flex items-center justify-center p-4">
        <div className="bg-white rounded-[32px] max-w-lg w-full p-8 md:p-12 text-center shadow-2xl">
          {uploadError ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-black text-stone-900 mb-3">Upload Failed</h2>
              <p className="text-stone-500 text-sm mb-6">{uploadError}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setUploadError(''); handleSubmit(); }}
                  className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl font-bold hover:bg-emerald-400 transition"
                >
                  Retry
                </button>
                <button
                  onClick={onCancel}
                  className="flex-1 bg-stone-200 text-stone-700 py-3 rounded-2xl font-bold hover:bg-stone-300 transition"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : uploadProgress < 100 ? (
            <>
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-emerald-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-xl font-black text-stone-900 mb-3">
                {stitchPhase === 'uploading' && 'Uploading Clips'}
                {stitchPhase === 'stitching' && 'Stitching Your Video'}
                {stitchPhase === 'processing' && 'Processing Video'}
                {stitchPhase === 'submitting' && 'Submitting Review'}
              </h2>
              <p className="text-stone-500 text-sm mb-4">
                {stitchPhase === 'uploading' && 'Sending your clips to the server...'}
                {stitchPhase === 'stitching' && 'Adding transitions and title cards between your clips...'}
                {stitchPhase === 'processing' && 'Uploading polished video to CDN...'}
                {stitchPhase === 'submitting' && 'Finalizing your review...'}
              </p>

              {recordedClips.length > 1 && (
                <div className="flex justify-center gap-1 mb-4">
                  {(['uploading', 'stitching', 'processing', 'submitting'] as StitchPhase[]).map((phase, idx) => {
                    const phases: StitchPhase[] = ['uploading', 'stitching', 'processing', 'submitting'];
                    const currentIdx = phases.indexOf(stitchPhase);
                    const isActive = idx <= currentIdx;
                    return (
                      <div key={phase} className="flex items-center gap-1">
                        <div className={`w-2.5 h-2.5 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-stone-200'}`} />
                        {idx < 3 && <div className={`w-4 h-0.5 transition-colors ${isActive ? 'bg-emerald-300' : 'bg-stone-200'}`} />}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-stone-400 text-xs mb-6">Please don't close this window...</p>
              <div className="w-full bg-stone-100 rounded-full h-3 mb-2">
                <div
                  className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm font-bold text-stone-600">{uploadProgress}%</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-black text-stone-900 mb-3">Review Submitted!</h2>
              <p className="text-stone-500 text-sm mb-4">
                Your video review will appear shortly after processing.
              </p>
              {trustWeightEarned > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6">
                  <p className="text-emerald-700 text-sm font-bold">
                    Trust Weight Earned: {trustWeightEarned.toFixed(2)}
                  </p>
                  <p className="text-emerald-600 text-xs mt-1">
                    Your video review carries extra weight in our integrity scoring
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  if (completedReview) onComplete(completedReview);
                  else onCancel();
                }}
                className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-400 transition shadow-lg shadow-emerald-200"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
};
