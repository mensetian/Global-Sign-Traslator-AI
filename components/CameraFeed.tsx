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
  isHandDetected: boolean; // Propiedad expuesta para verificar si hay manos
}

const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(({ isFlashing, langCode }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Canvas para captura (invisible)
  const overlayRef = useRef<HTMLCanvasElement>(null); // Canvas para dibujar esqueleto (visible)
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  
  // ESTADO: Controlamos el modo deseado ('user' = Frontal, 'environment' = Trasera)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isMirrored, setIsMirrored] = useState(false);

  // MediaPipe Refs
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(null);
  const isHandDetectedRef = useRef<boolean>(false); // Ref interno para acceso síncrono

  const t = TRANSLATIONS[langCode as LanguageCode] || TRANSLATIONS.Spanish;

  // Inicializar MediaPipe HandLandmarker
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
          numHands: 2
        });
        console.log("HandLandmarker loaded");
      } catch (error) {
        console.error("Error loading MediaPipe:", error);
      }
    };
    initMediaPipe();
  }, []);

  const drawHands = (result: any) => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Ajustar tamaño del canvas al video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    if (result.landmarks) {
      for (const landmarks of result.landmarks) {
        // Dibujar conectores
        drawConnectors(ctx, landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00f3ff", lineWidth: 2 });
        // Dibujar puntos
        drawLandmarks(ctx, landmarks, { color: "#FF0000", lineWidth: 1, radius: 3 });
      }
    }
  };

  // Funciones auxiliares de dibujo manuales para no depender de librerías externas de dibujo
  const drawConnectors = (ctx: CanvasRenderingContext2D, landmarks: any[], connections: any[], style: any) => {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    for (const connection of connections) {
      const start = landmarks[connection[0]];
      const end = landmarks[connection[1]];
      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start.x * ctx.canvas.width, start.y * ctx.canvas.height);
        ctx.lineTo(end.x * ctx.canvas.width, end.y * ctx.canvas.height);
        ctx.stroke();
      }
    }
  };

  const drawLandmarks = (ctx: CanvasRenderingContext2D, landmarks: any[], style: any) => {
    ctx.fillStyle = style.color;
    for (const landmark of landmarks) {
      ctx.beginPath();
      ctx.arc(landmark.x * ctx.canvas.width, landmark.y * ctx.canvas.height, style.radius, 0, 2 * Math.PI);
      ctx.fill();
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
        drawHands(results);
      } else {
        isHandDetectedRef.current = false;
        const ctx = overlayRef.current?.getContext('2d');
        ctx?.clearRect(0, 0, overlayRef.current?.width || 0, overlayRef.current?.height || 0);
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  // Función para encontrar la MEJOR cámara
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
          const scaleFactor = 320 / video.videoWidth;
          canvas.width = 320;
          canvas.height = video.videoHeight * scaleFactor;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          // IMPORTANTE: Captura imagen limpia (sin esqueleto)
          return canvas.toDataURL('image/jpeg', 0.6); 
        }
      }
      return null;
    },
    toggleCamera,
    get isHandDetected() {
        return isHandDetectedRef.current;
    }
  }));

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
                // Iniciar detección cuando el video arranca
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
            {/* Capa de Visualización (Esqueleto) */}
            <canvas 
                ref={overlayRef}
                className={`absolute inset-0 w-full h-full pointer-events-none ${isMirrored ? 'transform scale-x-[-1]' : ''}`}
            />
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
      
      {!streamError && (
        <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 z-20 pointer-events-none">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-bold tracking-widest text-white/80">{t.live}</span>
        </div>
      )}
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';
export default CameraFeed;