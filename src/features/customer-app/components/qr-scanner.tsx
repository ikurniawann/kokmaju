"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

/**
 * Pemindai QR layar penuh (aplikasi pelanggan): kamera belakang, pakai
 * BarcodeDetector bawaan (Android Chrome) atau jsQR (iPhone/Safari).
 */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const doneRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Kamera tidak tersedia di browser ini.");
        setStarting(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        setError("Izin kamera ditolak. Izinkan kamera lalu coba lagi, atau scan pakai aplikasi kamera HP.");
        setStarting(false);
        return;
      }
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setStarting(false);

      const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector })
        .BarcodeDetector;
      const detector = BarcodeDetectorCtor ? new BarcodeDetectorCtor({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;

      let busy = false;
      const tick = async () => {
        if (cancelled || doneRef.current) return;
        if (!busy && video.readyState >= 2) {
          busy = true;
          try {
            let text: string | null = null;
            if (detector) {
              const codes = await detector.detect(video);
              text = codes[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              const w = Math.min(640, video.videoWidth);
              const h = Math.round((video.videoHeight / video.videoWidth) * w);
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              text = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
            if (text && !doneRef.current) {
              doneRef.current = true;
              navigator.vibrate?.(30);
              onResult(text);
              return;
            }
          } catch {
            /* frame gagal dibaca — coba frame berikutnya */
          }
          busy = false;
        }
        raf = requestAnimationFrame(() => void tick());
      };
      raf = requestAnimationFrame(() => void tick());
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Scan QR meja">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
        <h2 className="text-base font-bold">Scan QR di meja</h2>
        <button type="button" onClick={onClose} aria-label="Tutup pemindai" className="grid size-10 place-items-center rounded-full bg-white/15">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="size-64 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {starting && (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="size-8 animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-x-4 top-1/3 rounded-2xl bg-white p-4 text-center text-sm font-medium text-gray-800">{error}</div>
        )}
      </div>
      <p className="px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 text-center text-sm text-white/80">
        Arahkan kamera ke QR code yang tertempel di meja.
      </p>
    </div>
  );
}
