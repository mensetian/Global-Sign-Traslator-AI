import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { AppState } from '../types';
import { TRANSLATIONS, LanguageCode } from '../utils/translations';
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

interface CameraFeedProps {
  appState: AppState;
  isFlashing: boolean;
  langCode: string;
}

export interface CameraFeedHandle {
  captureFrame: () => string | null;
  toggleCamera: () => void;
  isHandDetected: boolean;
  getHandVelocity: () => number; // 0 = quieto, >1 = movimiento
}

const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(({ isFlashing, langCode }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isMirrored, setIsMirrored] = useState(false);

  // MediaPipe Refs
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(null);
  const isHandDetectedRef = useRef<boolean>(false);
  
  const latestLandmarksRef = useRef<any[] | null>(null);
  
  // VELOCITY TRACKING (SMOOTHED)
  const prevLandmarksRef = useRef<any[] | null>(null);
  const smoothedVelocityRef = useRef<number>(0); 

  const t = TRANSLATIONS[langCode as LanguageCode] || TRANSLATIONS.Spanish;

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        console.log("HandLandmarker loaded");
      } catch (error) {
        console.error("Error loading MediaPipe:", error);
      }
    };
    initMediaPipe();
  }, []);

  const calculateVelocity = (currentLandmarks: any[]) => {
    if (!prevLandmarksRef.current || prevLandmarksRef.current.length === 0) {
      prevLandmarksRef.current = currentLandmarks;
      return 0;
    }

    let totalDelta = 0;
    let points = 0;

    // Analizamos la primera mano detectada
    const hand1Curr = currentLandmarks[0];
    const hand1Prev = prevLandmarksRef.current[0];

    if (hand1Curr && hand1Prev) {
      // Puntos clave: Muñeca (0), Índice(8), Medio(12), Pulgar(4)
      const keypoints = [0, 8, 12]; 
      
      for (const idx of keypoints) {
        const p1 = hand1Curr[idx];
        const p2 = hand1Prev[idx];
        if (p1 && p2) {
           const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
           totalDelta += dist;
           points++;
        }
      }
    }

    prevLandmarksRef.current = currentLandmarks;
    
    // Velocidad instantánea normalizada 
    const rawVelocity = points > 0 ? (totalDelta / points) * 200 : 0; 
    
    // SUAVIZADO (EMA) - Adjusted from 0.75 to 0.6 for smoother results
    const alpha = 0.6;
    smoothedVelocityRef.current = (alpha * rawVelocity) + ((1 - alpha) * smoothedVelocityRef.current);
    
    // Filtro de ruido
    if (smoothedVelocityRef.current < 0.12) smoothedVelocityRef.current = 0;

    return smoothedVelocityRef.current;
  };

  const drawSkeletonOnContext = (ctx: CanvasRenderingContext2D, landmarksList: any[], width: number, height: number) => {
    for (const landmarks of landmarksList) {
       const connections = HandLandmarker.HAND_CONNECTIONS;
       ctx.strokeStyle = "#00f3ff";
       ctx.lineWidth = 2;
       for (const connection of connections) {
          const start = landmarks[connection[0]];
          const end = landmarks[connection[1]];
          if (start && end) {
             ctx.beginPath();
             ctx.moveTo(start.x * width, start.y * height);
             ctx.lineTo(end.x * width, end.y * height);
             ctx.stroke();
          }
       }
       ctx.fillStyle = "#FF0000";
       for (const landmark of landmarks) {
          ctx.beginPath();
          ctx.arc(landmark.x * width, landmark.y * height, 2, 0, 2 * Math.PI);
          ctx.fill();
       }
    }
  };

  const drawHandsToOverlay = (result: any) => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    if (result.landmarks) {
       drawSkeletonOnContext(ctx, result.landmarks, canvas.width, canvas.height);
    }
  };

  const predictWebcam = () => {
    if (
      handLandmarkerRef.current && 
      videoRef.current && 
      videoRef.current.readyState >= 2
    ) {
      const startTimeMs = performance.now();
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
      
      if (results.landmarks && results.landmarks.length > 0) {
        isHandDetectedRef.current = true;
        latestLandmarksRef.current = results.landmarks;
        calculateVelocity(results.landmarks);
        drawHandsToOverlay(results);
      } else {
        isHandDetectedRef.current = false;
        latestLandmarksRef.current = null;
        // Si se pierden las manos, velocidad a 0 inmediatamente
        smoothedVelocityRef.current = 0;
        const ctx = overlayRef.current?.getContext('2d');
        ctx?.clearRect(0, 0, overlayRef.current?.width || 0, overlayRef.current?.height || 0);
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  // ... (Device logic unchanged)
  const findBestDeviceId = async (mode: 'user' | 'environment'): Promise<string | null> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return null;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      if (videoInputs.length === 0) return null;

      const isBack = (label: string) => label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('trasera');
      const isFront = (label: string) => label.includes('front') || label.includes('user') || label.includes('anterior') || label.includes('delantera');
      const isAuxiliary = (label: string) => label.includes('wide') || label.includes('ultra') || label.includes('macro') || label.includes('tele') || label.includes('zoom');

      let candidates: MediaDeviceInfo[] = [];

      if (mode === 'environment') {
         const backCams = videoInputs.filter(d => isBack(d.label.toLowerCase()));
         candidates = backCams.filter(d => !isAuxiliary(d.label.toLowerCase()));
         if (candidates.length === 0) candidates = backCams;
         if (candidates.length === 0) candidates = videoInputs.filter(d => !isFront(d.label.toLowerCase()));
      } else {
         candidates = videoInputs.filter(d => isFront(d.label.toLowerCase()));
         if (candidates.length === 0) candidates = videoInputs; 
      }

      if (candidates.length > 0 && candidates[0].label === "") return null;
      return candidates.length > 0 ? candidates[0].deviceId : null;

    } catch (e) {
      console.warn("Error buscando dispositivos:", e);
      return null;
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const stopCamera = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    stopCamera(); 
    setStreamError(null);
    setIsPermissionDenied(false);
    
    try {
        const targetDeviceId = await findBestDeviceId(facingMode);
        const constraints: MediaStreamConstraints = {
            video: targetDeviceId 
              ? { deviceId: { exact: targetDeviceId }, width: { ideal: 640 } }
              : { facingMode: facingMode, width: { ideal: 640 } },
            audio: false
        };

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (firstError) {
            const fallbackConstraints = targetDeviceId 
                ? { video: { deviceId: { exact: targetDeviceId } } }
                : { video: { facingMode: facingMode } };
            stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        }
      
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play().catch(e => console.error("Error play:", e));
                predictWebcam();
            };
        }
      
        setIsMirrored(facingMode === 'user');

    } catch (err: any) {
        console.error("Error iniciando cámara:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setIsPermissionDenied(true);
        }
        setStreamError("ERROR_ACCESS");
    }
  };

  useEffect(() => {
    const t = setTimeout(() => startCamera(), 100);
    return () => {
        clearTimeout(t);
        stopCamera();
    };
  }, [facingMode]);

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
            return null;
        }
        const context = canvas.getContext('2d');
        if (context) {
          // AUMENTAMOS LA RESOLUCIÓN DE CAPTURA PARA GEMINI PRO
          const targetWidth = 480; // Antes 320. Más píxeles = mejor precisión de dedos.
          const scaleFactor = targetWidth / video.videoWidth;
          canvas.width = targetWidth;
          canvas.height = video.videoHeight * scaleFactor;
          
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          if (latestLandmarksRef.current) {
             drawSkeletonOnContext(context, latestLandmarksRef.current, canvas.width, canvas.height);
          }
          // Mejor calidad de compresión para el modelo Pro
          return canvas.toDataURL('image/jpeg', 0.7); 
        }
      }
      return null;
    },
    toggleCamera,
    get isHandDetected() {
        return isHandDetectedRef.current;
    },
    getHandVelocity: () => {
        return smoothedVelocityRef.current;
    }
  }));

  return (
    <div 
      id="camera-feed"
      className={`
        relative w-full overflow-hidden bg-black shadow-2xl transition-all duration-300
        aspect-[3/4] 
        landscape:aspect-video landscape:rounded-none
        md:aspect-video md:rounded-3xl
        ${isFlashing ? 'border-vibe-neon/50' : 'border-white/10 border'} 
      `}
    >
      {streamError ? (
        <div className="flex flex-col items-center justify-center h-full text-red-500 font-bold p-4 text-center z-10 relative">
          <p className="text-lg">{t.errorCamera}</p>
          <p className="text-xs font-normal mt-2 text-gray-400 max-w-[250px]">
            {isPermissionDenied ? "Acceso denegado." : t.checkPermissions}
          </p>
          <button onClick={() => startCamera()} className="mt-6 px-6 py-2 bg-white/10 rounded-full">{t.resume}</button>
        </div>
      ) : (
        <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover opacity-90 ${isMirrored ? 'transform scale-x-[-1]' : ''}`} 
            />
            <canvas 
                ref={overlayRef}
                className={`absolute inset-0 w-full h-full pointer-events-none ${isMirrored ? 'transform scale-x-[-1]' : ''}`}
            />
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
      
      {!streamError && (
        <div className="absolute top-4 left-4 flex flex-col items-start gap-1 z-20 pointer-events-none">
          <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
             <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] font-bold tracking-widest text-white/80">{t.live}</span>
          </div>
        </div>
      )}
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';
export default CameraFeed;