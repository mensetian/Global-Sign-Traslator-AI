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
}

const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(({ isFlashing, langCode }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);

  const t = TRANSLATIONS[langCode as LanguageCode] || TRANSLATIONS.Spanish;

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        const context = canvas.getContext('2d');
        if (context && video.videoWidth > 0) {
          // OPTIMIZACIÓN AGRESIVA PARA RÁFAGA (BURST MODE)
          // Bajamos a 320px de ancho. Suficiente para detectar manos, 
          // pero hace que el payload de 3 imágenes sea ligero.
          const scaleFactor = 320 / video.videoWidth;
          canvas.width = 320;
          canvas.height = video.videoHeight * scaleFactor;
          
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Calidad 0.5: Balance perfecto entre velocidad de subida y nitidez
          return canvas.toDataURL('image/jpeg', 0.5); 
        }
      }
      return null;
    }
  }));

  const startCamera = async () => {
    setStreamError(null);
    setIsPermissionDenied(false);
    try {
      // INTENTO 1: Configuración Ideal (Cámara frontal, frameRate alto)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, // Capturamos a 640 pero reducimos en canvas
          frameRate: { ideal: 30 } // Importante para capturar movimiento fluido
        },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err1) {
      console.warn("Intento 1 de cámara falló, probando configuración básica...", err1);
      try {
        // INTENTO 2: Fallback Genérico
        const streamFallback = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = streamFallback;
        }
      } catch (err2: any) {
        console.error("Error fatal de cámara:", err2);
        
        // Detectar si es error de permisos
        if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError' || err2.message.includes('Permission denied')) {
            setIsPermissionDenied(true);
        }
        
        setStreamError("ERROR_ACCESS");
      }
    }
  };

  useEffect(() => {
    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
            onClick={startCamera}
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
          className="w-full h-full object-cover transform scale-x-[-1] opacity-90" 
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