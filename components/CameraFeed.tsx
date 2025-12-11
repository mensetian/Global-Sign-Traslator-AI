import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { AppState } from '../types';
import { TRANSLATIONS, LanguageCode } from '../utils/translations';

interface CameraFeedProps {
  appState: AppState;
  isFlashing: boolean;
  langCode: string;
}

export interface CameraFeedHandle {
  captureFrame: () => string | null;
  toggleCamera: () => void;
}

const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(({ isFlashing, langCode }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  
  // GESTIÓN DE DISPOSITIVOS
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [isMirrored, setIsMirrored] = useState(false);

  const t = TRANSLATIONS[langCode as LanguageCode] || TRANSLATIONS.Spanish;

  const updateDeviceList = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setVideoDevices(videoInputs);
      return videoInputs;
    } catch (e) {
      console.warn("Error listando dispositivos:", e);
      return [];
    }
  };

  const toggleCamera = async () => {
    let currentDevices = videoDevices;
    if (currentDevices.length === 0) {
      currentDevices = await updateDeviceList();
    }
    
    if (currentDevices.length < 2) return;
    
    const currentIndex = currentDevices.findIndex(d => d.deviceId === activeDeviceId);
    // Si no encuentra el actual (-1), empieza por el 1 (asumiendo 0 era default).
    // Si encuentra, pasa al siguiente.
    let nextIndex = (currentIndex + 1) % currentDevices.length;
    
    // Safety check
    if (!currentDevices[nextIndex]) nextIndex = 0;
    
    const nextDevice = currentDevices[nextIndex];
    if (nextDevice) {
       console.log("Cambiando cámara a:", nextDevice.label || nextDevice.deviceId);
       setActiveDeviceId(nextDevice.deviceId);
    }
  };

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        const context = canvas.getContext('2d');
        if (context && video.videoWidth > 0) {
          const scaleFactor = 320 / video.videoWidth;
          canvas.width = 320;
          canvas.height = video.videoHeight * scaleFactor;
          
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.5); 
        }
      }
      return null;
    },
    toggleCamera
  }));

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
          track.stop();
          // Importante: En algunos Android antiguos, stop() no libera inmediatamente.
      });
      videoRef.current.srcObject = null;
    }
  };

  const getStream = async (constraints: MediaStreamConstraints): Promise<MediaStream | null> => {
      try {
          return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
          console.warn("Fallo intento constraints:", constraints, e);
          return null;
      }
  };

  const startCamera = async () => {
    stopCamera(); 
    setStreamError(null);
    setIsPermissionDenied(false);
    
    let stream: MediaStream | null = null;
    
    try {
        // --- INTENTO 1: Configuración específica (ID o Environment + Calidad) ---
        // Si hay activeDeviceId, usamos ese. Si no, 'environment'.
        // Incluimos width ideal, pero sin 'exact' para no romper si la cámara no lo soporta.
        const baseConstraints: MediaStreamConstraints = {
            video: activeDeviceId 
              ? { deviceId: { exact: activeDeviceId }, width: { ideal: 640 } }
              : { facingMode: 'environment', width: { ideal: 640 } },
            audio: false
        };
        
        stream = await getStream(baseConstraints);

        // --- INTENTO 2: Configuración relajada (Sin resolución) ---
        // Si falló el anterior, probamos sin width/height. Muchas cámaras Wide fallan con restricciones.
        if (!stream) {
            console.log("Reintentando sin restricciones de resolución...");
            const relaxedConstraints: MediaStreamConstraints = {
                video: activeDeviceId 
                  ? { deviceId: { exact: activeDeviceId } }
                  : { facingMode: 'environment' },
                audio: false
            };
            stream = await getStream(relaxedConstraints);
        }

        // --- INTENTO 3: Cualquier cámara trasera (si falló ID específico) ---
        if (!stream && activeDeviceId) {
             console.log("ID específico falló, probando environment genérico...");
             // Reseteamos el ID activo porque evidentemente no funcionó
             setActiveDeviceId(null); 
             stream = await getStream({ video: { facingMode: 'environment' }, audio: false });
        }

        // --- INTENTO 4: Lo que sea (Fallback final) ---
        if (!stream) {
            console.log("Fallback final: video: true");
            stream = await getStream({ video: true, audio: false });
        }

        // Si después de todo esto no hay stream, lanzamos error
        if (!stream) {
            throw new Error("Could not start video source after multiple attempts");
        }
      
      // CONFIGURACIÓN DEL VIDEO
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Esperar a que cargue metadata para saber si está listo
        videoRef.current.onloadedmetadata = () => {
             videoRef.current?.play().catch(e => console.error("Error play:", e));
        };
      }
      
      // ANÁLISIS DEL STREAM ACTIVO (para actualizar UI y estado)
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      
      if (!activeDeviceId && settings.deviceId) {
         setActiveDeviceId(settings.deviceId);
      }
      
      // Detección de espejo
      if (settings.facingMode === 'user') {
          setIsMirrored(true);
      } else if (settings.facingMode === 'environment') {
          setIsMirrored(false);
      } else {
          const label = track.label?.toLowerCase() || '';
          setIsMirrored(label.includes('front') || label.includes('anterior') || label.includes('user'));
      }
      
      await updateDeviceList();

    } catch (err: any) {
        console.error("Error fatal de cámara:", err);
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setIsPermissionDenied(true);
        }
        
        setStreamError("ERROR_ACCESS");
    }
  };

  useEffect(() => {
    // Pequeño delay para permitir que el DOM renderice y el componente anterior libere la cámara
    const timer = setTimeout(() => {
        startCamera();
    }, 100);
    return () => {
        clearTimeout(timer);
        stopCamera();
    };
  }, [activeDeviceId]); 

  return (
    <div 
      id="camera-feed"
      className={`
        relative w-full overflow-hidden bg-black shadow-2xl transition-all duration-300
        
        /* DISEÑO RESPONSIVO DE ASPECTO: */
        aspect-[3/4] 
        landscape:aspect-video landscape:rounded-none
        md:aspect-video md:rounded-3xl
        
        ${isFlashing ? 'border-vibe-neon/50' : 'border-white/10 border'} 
      `}
    >
      {streamError ? (
        <div className="flex flex-col items-center justify-center h-full text-red-500 font-bold p-4 text-center z-10 relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4 opacity-50">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
          </svg>

          <p className="text-lg">{t.errorCamera}</p>
          <p className="text-xs font-normal mt-2 text-gray-400 max-w-[250px]">
            {isPermissionDenied ? "Acceso denegado. Habilita los permisos de cámara en tu navegador." : t.checkPermissions}
          </p>

          <button 
            onClick={() => setActiveDeviceId(null)} 
            className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-full border border-white/20 transition-all active:scale-95"
          >
            {t.resume || "Reintentar"}
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover opacity-90 ${isMirrored ? 'transform scale-x-[-1]' : ''}`} 
        />
      )}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Marco Guía */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
        <div className="w-2/3 h-3/4 border-2 border-dashed border-white/40 rounded-3xl"></div>
      </div>
      
      {/* Indicador 'LIVE' */}
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