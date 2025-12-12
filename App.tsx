import React, { useState, useRef, useEffect, useCallback } from 'react';
import CameraFeed, { CameraFeedHandle } from './components/CameraFeed';
import ResultsDisplay from './components/ResultsDisplay';
import { sendImageToGemini } from './services/geminiService';
import { AppState, TranslationResult } from './types';
import { TRANSLATIONS, LanguageCode } from './utils/translations';

const LANGUAGES = [
  { code: 'Spanish', label: 'ES', full: 'Español' },
  { code: 'English', label: 'EN', full: 'English' },
  { code: 'Portuguese', label: 'PT', full: 'Português' }
];

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('Spanish');
  const [isActive, setIsActive] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  // INICIO SEGURO: Empezamos en PLAY (false)
  const [isPaused, setIsPaused] = useState(false); 
  
  const isPausedRef = useRef(isPaused);
  const cameraRef = useRef<CameraFeedHandle>(null);
  const isRunningRef = useRef(true);
  const languageRef = useRef(targetLanguage);
  
  const lastTextRef = useRef("");

  const t = TRANSLATIONS[targetLanguage as LanguageCode] || TRANSLATIONS.Spanish;

  useEffect(() => {
    languageRef.current = targetLanguage;
  }, [targetLanguage]);
  
  useEffect(() => {
    if (isPaused) {
       // Paused logic if needed
    }
  }, [isPaused]);

  useEffect(() => {
    isPausedRef.current = isPaused;
    
    if (!isPaused) {
      setAppState(AppState.ANALYZING);
      // Give camera time to warm up (1.5s)
      const timer = setTimeout(() => {
         if (isRunningRef.current && !isPausedRef.current) processFrame();
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setAppState(AppState.IDLE);
      setIsActive(false);
    }
  }, [isPaused]);

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const processFrame = useCallback(async () => {
    if (!isRunningRef.current || isPausedRef.current) return;
    if (isRateLimited) return;

    // --- 1. Detección Local de Manos (Cliente) ---
    // Si no hay manos, no gastamos cuota de API.
    const hasHands = cameraRef.current?.isHandDetected;

    if (!hasHands) {
        // UI Feedback: Cambiar a modo búsqueda si estábamos activos
        if (appState !== AppState.IDLE) setAppState(AppState.IDLE);
        
        // Volver a revisar muy rápido (100ms) para sentir que es "Tiempo Real"
        setTimeout(() => {
            if (isRunningRef.current && !isPausedRef.current) processFrame();
        }, 100);
        return;
    }

    // --- 2. Captura en Ráfaga (Burst Capture) ---
    // Solo llegamos aquí si hay manos detectadas
    const frames: string[] = [];
    
    // Frame 1 (T=0ms)
    const f1 = cameraRef.current?.captureFrame();
    if (f1) frames.push(f1);
    
    await wait(80);
    
    // Frame 2 (T=80ms)
    const f2 = cameraRef.current?.captureFrame();
    if (f2) frames.push(f2);
    
    await wait(80);
    
    // Frame 3 (T=160ms)
    const f3 = cameraRef.current?.captureFrame();
    if (f3) frames.push(f3);

    // Solo procesamos si tenemos al menos 2 frames válidos para detectar movimiento
    if (frames.length >= 1) {
      setIsActive(true); 
      setAppState(AppState.ANALYZING);
      const startTime = Date.now();

      try {
        // --- GESTIÓN INTELIGENTE DE CONTEXTO ---
        let safeContext = lastTextRef.current;
        const sentences = safeContext.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [];
        if (sentences.length > 1) {
            safeContext = sentences[sentences.length - 1].trim();
        } else if (safeContext.length > 100) {
            safeContext = "..." + safeContext.slice(-100);
        }
        
        const result = await sendImageToGemini(frames, languageRef.current, safeContext);
        
        if (isPausedRef.current) {
             setIsActive(false);
             setAppState(AppState.IDLE);
             return; 
        }
        
        // Actualizar UI
        if (result.traduccion && result.traduccion !== "..." && result.traduccion.trim().length > 0) {
             setTranslationResult(result);
             lastTextRef.current = result.traduccion; 
        }
        setAppState(AppState.SUCCESS);

        const elapsed = Date.now() - startTime;
        // Si detectamos manos y procesamos con éxito, esperamos un poco más para respetar Rate Limits.
        // Como solo llamamos cuando hay manos, podemos permitirnos ser un poco más agresivos (2s)
        const minimumDelay = 2500; 
        const nextDelay = Math.max(0, minimumDelay - elapsed);

        setTimeout(() => {
            if (isRunningRef.current && !isPausedRef.current) processFrame();
        }, nextDelay);

      } catch (error: any) {
        const errString = error?.message || error?.toString() || JSON.stringify(error) || '';
        const isQuotaError = errString.includes('429') || errString.includes('quota') || errString.includes('RESOURCE_EXHAUSTED');

        if (isQuotaError) {
          console.warn("Loop error (Quota): Rate Limit hit. Pausing for 10s...");
          setIsRateLimited(true);
          setTimeout(() => {
            setIsRateLimited(false);
            if (isRunningRef.current && !isPausedRef.current) processFrame();
          }, 10000); 
        } else {
          console.error("Loop error:", error);
          // Error genérico, esperar 2s y reintentar
          setTimeout(() => {
              if (isRunningRef.current && !isPausedRef.current) processFrame();
          }, 2000);
        }
      } finally {
        if (!isPausedRef.current) {
            setIsActive(false);
        }
      }
    } else {
      // Si la cámara no está lista (frames vacíos), esperar antes de reintentar
      setTimeout(() => {
          if (isRunningRef.current && !isPausedRef.current) processFrame();
      }, 1000);
    }
  }, [isRateLimited, appState]);

  useEffect(() => {
    isRunningRef.current = true;
    return () => {
      isRunningRef.current = false;
    };
  }, []);

  return (
    <div className="h-dvh w-screen bg-vibe-bg flex flex-col items-center justify-between overflow-hidden relative font-sans">
      
      {/* HEADER INTEGRADO */}
      <div className={`
        w-full flex flex-col items-center pt-6 pb-2 px-4 z-40 space-y-4 
        bg-gradient-to-b from-vibe-bg to-transparent
        landscape:absolute landscape:top-0 landscape:left-0 landscape:flex-row landscape:justify-end landscape:p-4 landscape:space-y-0 landscape:bg-none landscape:pointer-events-none
        md:landscape:relative md:landscape:flex-col md:landscape:items-center md:landscape:justify-start md:landscape:bg-gradient-to-b md:landscape:pt-6 md:landscape:space-y-4 md:landscape:pointer-events-auto
      `}>
        <h1 className="text-white/30 font-light tracking-[0.3em] text-[10px] uppercase select-none landscape:hidden md:landscape:block text-center">
          Global Sign Translator <span className="block md:inline text-[9px] text-vibe-neon opacity-70 mt-1 md:mt-0 md:ml-2">Powered by Gemini</span>
        </h1>

        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="flex bg-white/5 backdrop-blur-md rounded-full p-1 border border-white/10 shadow-lg">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setTargetLanguage(lang.code);
                  lastTextRef.current = ""; 
                  setTranslationResult(null);
                }}
                className={`
                  px-3 py-2 rounded-full text-[10px] font-bold tracking-wider transition-all duration-300
                  ${targetLanguage === lang.code 
                    ? 'bg-vibe-neon text-black shadow-[0_0_10px_rgba(0,243,255,0.3)]' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'}
                `}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 w-full md:max-w-6xl lg:max-w-7xl flex flex-col justify-center items-center relative px-0 md:px-4">
        
        {/* Camera Container */}
        <div className="relative w-full flex flex-col items-center group landscape:h-full md:landscape:h-auto md:landscape:max-h-[75vh] lg:landscape:max-h-[80vh]">
          
          <CameraFeed 
            ref={cameraRef} 
            appState={appState} 
            isFlashing={isActive}
            langCode={targetLanguage}
          />

          <div className="absolute top-4 right-4 z-50 flex gap-3">
            <button
                onClick={() => cameraRef.current?.toggleCamera()}
                className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 bg-black/40 text-white/80 hover:bg-white/10 hover:text-white transition-all duration-300 shadow-lg active:scale-90"
                title="Cambiar Cámara"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
            </button>

            <button
              onClick={() => {
                const newPausedState = !isPaused;
                setIsPaused(newPausedState);
              }}
              className={`
                w-9 h-9 rounded-full flex items-center justify-center 
                backdrop-blur-md border transition-all duration-300 shadow-lg
                ${!isPaused 
                  ? 'bg-red-500/20 border-red-500/30 text-red-500 hover:bg-red-500/30' 
                  : 'bg-vibe-neon/20 border-vibe-neon/30 text-vibe-neon hover:bg-vibe-neon/30 hover:shadow-[0_0_15px_rgba(0,243,255,0.4)]'}
              `}
              title={!isPaused ? t.pause : t.resume}
            >
              {!isPaused ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5">
                   <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>

          {isPaused && (
             <div className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[2px] rounded-3xl transition-all duration-500">
                <div className="bg-black/40 px-6 py-2 rounded-full border border-white/5">
                  <p className="text-white/50 text-xs tracking-[0.3em] font-light animate-pulse">{t.paused}</p>
                </div>
             </div>
          )}

          {isRateLimited && !isPaused && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-yellow-500/30 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
                  <span className="text-[10px] font-medium text-yellow-200 tracking-wide uppercase">
                    {t.apiLimit}
                  </span>
               </div>
            </div>
          )}

        </div>

        {/* RESULTADOS */}
        <div className={`
            absolute bottom-6 left-0 right-0 z-50 px-4 w-full flex justify-center pointer-events-none
            md:bottom-12
        `}>
          <div className="w-full max-w-xl pointer-events-auto">
             <ResultsDisplay 
                result={translationResult} 
                appState={appState} 
                langCode={targetLanguage}
             />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-vibe-neon rounded-full blur-[180px] opacity-10 pointer-events-none z-0 landscape:hidden md:landscape:block"></div>
    </div>
  );
};

export default App;