import { useCallback, useRef, useState } from 'react';

const MAX_DURATION_MS = 5 * 60 * 1000;

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/mp4'; // iOS Safari
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setIsRecording(true);
    setDurationMs(0);

    timerRef.current = setInterval(() => setDurationMs(Date.now() - startedAtRef.current), 200);
    maxTimeoutRef.current = setTimeout(() => recorder.stop(), MAX_DURATION_MS);
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsRecording(false);
  }, []);

  const stop = useCallback((): Promise<{ blob: Blob; mimeType: string; durationMs: number } | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const duration = Date.now() - startedAtRef.current;
        cleanup();
        resolve({ blob, mimeType, durationMs: duration });
      };
      recorder.stop();
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    recorderRef.current?.stop();
    chunksRef.current = [];
    cleanup();
  }, [cleanup]);

  return { isRecording, durationMs, start, stop, cancel };
}
