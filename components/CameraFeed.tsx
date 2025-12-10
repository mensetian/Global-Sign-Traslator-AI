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

  const t = TRANSLATIONS[langCode as LanguageCode] || TRANSLATIONS.Spanish;

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        const context = canvas.getContext('2d');
        if (context && video.videoWidth > 0) {
          // OPTIMIZACIÓN: Reducir resolución para envío rápido
          const scaleFactor = 480 / video.videoWidth;
          canvas.width = 480;
          canvas.height = video.videoHeight * scaleFactor;
          
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.6); // Compresión 0.6 para velocidad móvil
        }
      }
      return null;
    }
  }));

  useEffect(() => {
    const startCamera = async () => {
      setStreamError(null);
      try {
        // INTENTO 1: Configuración Ideal (Cámara frontal, buena resolución)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user', 
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err1) {
        console.warn("Intento 1 de cámara falló, probando configuración básica...", err1);
        try {
          // INTENTO 2: Fallback Genérico (Cualquier cámara, resolución por defecto)
          // Esto soluciona el error "Could not start video source" en la mayoría de casos
          const streamFallback = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          if (videoRef.current) {
            videoRef.current.srcObject = streamFallback;
          }
        } catch (err2) {
          console.error("Error fatal de cámara:", err2);
          setStreamError("ERROR_ACCESS");
        }
      }
    };

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
        /* Móvil Vertical: 3:4 (Portrait) */
        aspect-[3/4] 
        /* Móvil Horizontal: 16:9 (Landscape) - Llenar pantalla ancha */
        landscape:aspect-video landscape:rounded-none
        /* Desktop (MD+): Siempre 16:9 y redondeado */
        md:aspect-video md:rounded-3xl
        
        ${isFlashing ? 'border-vibe-neon/50' : 'border-white/10 border'} 
      `}
    >
      {streamError ? (
        <div className="flex flex-col items-center justify-center h-full text-red-500 font-bold p-4 text-center">
          <p>{t.errorCamera}</p>
          <p className="text-xs font-normal mt-2 text-gray-400">{t.checkPermissions}</p>
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
      <div className="absolute top-4 right-4 flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 z-20">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        <span className="text-[10px] font-bold tracking-widest text-white/80">{t.live}</span>
      </div>
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';
export default CameraFeed;