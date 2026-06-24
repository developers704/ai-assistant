"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Camera, Loader2, SwitchCamera, X, AlertTriangle } from "lucide-react";

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
}

async function requestCameraStream(facing: "environment" | "user"): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not supported in this browser.");
  }

  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { exact: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
    { video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: true, audio: false },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Could not access camera.");
}

export function CameraModal({
  open,
  onClose,
  onCapture,
  title = "Capture photo",
}: CameraModalProps) {
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onCloseRef = useRef(onClose);
  const onCaptureRef = useRef(onCapture);

  onCloseRef.current = onClose;
  onCaptureRef.current = onCapture;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const bindStreamToVideo = useCallback(async (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return false;

    video.srcObject = stream;
    try {
      await video.play();
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setCameraReady(true);
        return true;
      }
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
      await video.play();
      setCameraReady(true);
      return true;
    } catch {
      setCameraReady(false);
      return false;
    }
  }, []);

  const startCamera = useCallback(
    async (facing: "environment" | "user") => {
      setCameraError(null);
      setCameraReady(false);
      stopCamera();

      try {
        const stream = await requestCameraStream(facing);
        streamRef.current = stream;
        setFacingMode(facing);

        const bound = await bindStreamToVideo(stream);
        if (!bound) {
          // Video element may not be mounted yet — retry on next frame.
          requestAnimationFrame(() => {
            if (streamRef.current === stream) {
              bindStreamToVideo(stream);
            }
          });
        }
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access in your browser settings."
            : err instanceof DOMException && err.name === "NotFoundError"
              ? "No camera found on this device."
              : err instanceof Error
                ? err.message
                : "Could not access camera.";
        setCameraError(msg);
        stopCamera();
      }
    },
    [bindStreamToVideo, stopCamera]
  );

  // Start/stop when modal opens — stable deps only (no onClose).
  useEffect(() => {
    if (!open) {
      stopCamera();
      setCameraError(null);
      return;
    }
    startCamera("environment");
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  const handleClose = () => {
    stopCamera();
    onCloseRef.current();
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCaptureRef.current(
          new File([blob], `camera-capture-${Date.now()}.jpg`, { type: "image/jpeg" })
        );
        handleClose();
      },
      "image/jpeg",
      0.92
    );
  };

  const switchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    startCamera(next);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Camera size={18} /> {title}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Close camera"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] border border-white/10">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 size={32} className="text-white animate-spin" />
              <p className="text-xs text-white/70">Starting camera…</p>
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <AlertTriangle size={28} className="text-amber-400" />
              <p className="text-sm text-white">{cameraError}</p>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={switchCamera}
            disabled={!cameraReady}
          >
            <SwitchCamera size={16} /> Flip camera
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={capture}
            disabled={!cameraReady}
            className="min-w-[160px]"
          >
            <Camera size={18} /> Capture
          </Button>
          {cameraError ? (
            <Button type="button" onClick={() => startCamera(facingMode)}>
              Retry
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
