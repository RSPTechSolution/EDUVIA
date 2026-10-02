'use client';
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';

export default function GateTerminal() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<any | null>(null);
  const [scanning, setScanning] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
        .catch(e => console.error("Camera error:", e));
    }
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    const scan = () => {
      if (!scanning || !videoRef.current || !canvasRef.current) {
        animationFrameId = requestAnimationFrame(scan);
        return;
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (code?.data) {
          processQr(code.data);
        }
      }
      animationFrameId = requestAnimationFrame(scan);
    };
    if (mounted) scan();
    return () => cancelAnimationFrame(animationFrameId);
  }, [scanning, mounted]);

  const processQr = async (token: string) => {
    setScanning(false);
    try {
      const res = await apiClient.post('/schools/security/gate/scan', { token });
      setResult(res.data);
    } catch (e) {
      setResult({ status: 'rejected', person: { name: 'Unknown' }, message: 'Network Error' });
    }
    setTimeout(() => { setResult(null); setScanning(true); }, 4000);
  };

  return (
    <div className="relative h-[calc(100vh-100px)] w-full bg-black overflow-hidden rounded-xl">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {scanning && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-64 w-64">
            <div className="absolute inset-0 rounded-2xl border-2 border-white/80" />
            {['top-0 left-0','top-0 right-0','bottom-0 left-0','bottom-0 right-0'].map((pos, i) => (
              <div key={i} className={`absolute ${pos} h-8 w-8 border-4 border-primary rounded-sm`}
                style={{ borderRadius: i === 0 ? '8px 0 0 0' : i === 1 ? '0 8px 0 0' : i === 2 ? '0 0 0 8px' : '0 0 8px 0' }} />
            ))}
            <div className="absolute left-2 right-2 h-0.5 bg-primary/80 animate-pulse top-1/2" />
          </div>
          <p className="absolute bottom-1/4 text-white/80 text-sm">Scan Gate Pass QR Code</p>
        </div>
      )}

      {result && (
        <div className={cn(
          'absolute inset-0 flex flex-col items-center justify-center gap-6 transition-all',
          result.status === 'approved' ? 'bg-success/90' : 'bg-destructive/90',
        )} aria-live="assertive">
          <div className="text-center text-white">
            <p className="text-4xl font-bold">{result.person?.name ?? 'Unknown'}</p>
            <p className="text-xl mt-2 opacity-90 font-medium">
              {result.status === 'approved' ? '✓ Gate Pass Valid — Exit Approved' : `✗ ${result.message}`}
            </p>
          </div>
          <div className="rounded-full p-6 bg-white/20">
            {result.status === 'approved' ? <CheckCircle2 className="h-20 w-20 text-white" /> : <XCircle className="h-20 w-20 text-white" />}
          </div>
        </div>
      )}
    </div>
  );
}
