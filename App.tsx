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
  
  const cameraRef = useRef<CameraFeedHandle>(null);
  const isRunningRef = useRef(true);
  const languageRef = useRef(targetLanguage);

  // Get current translation object
  const t = TRANSLATIONS[targetLanguage as LanguageCode] || TRANSLATIONS.Spanish;

  useEffect(() => {
    languageRef.current = targetLanguage;
  }, [targetLanguage]);

  const processFrame = useCallback(async () => {
    if (!isRunningRef.current) return;
    if (isRateLimited) return;

    const imageSrc = cameraRef.current?.captureFrame();

    if (imageSrc) {
      setIsActive(true); 
      setAppState(AppState.ANALYZING);
      const startTime = Date.now();

      try {
        const result = await sendImageToGemini(imageSrc, languageRef.current);
        
        if (result.traduccion !== "..." && result.traduccion.trim() !== "") {
             setTranslationResult(result);
        }
        setAppState(AppState.SUCCESS);

        const elapsed = Date.now() - startTime;
        // Aumentamos el delay base a 2000ms para respetar mejor la cuota gratuita (15 RPM)
        // 2000ms + tiempo de proceso (~1000ms) = ~3s por petición = ~20 RPM (todavía alto pero mejor)
        const minimumDelay = 2000; 
        const nextDelay = Math.max(0, minimumDelay - elapsed);

        setTimeout(() => {
            if (isRunningRef.current) processFrame();
        }, nextDelay);

      } catch (error: any) {
        // Detección robusta de errores de cuota (429)
        const errString = error?.toString()?.toLowerCase() || '';
        const isQuotaError = 
          errString.includes('429') || 
          errString.includes('quota') || 
          errString.includes('resource_exhausted') ||
          error?.status === 429 ||
          error?.error?.code === 429 ||
          error?.response?.status === 429;

        if (isQuotaError) {
          console.warn("Cuota de API excedida (429). Entrando en modo enfriamiento...");
          setIsRateLimited(true);
          // Esperar 10 segundos antes de reintentar
          setTimeout(() => {
            setIsRateLimited(false);
            if (isRunningRef.current) processFrame();
          }, 10000);
        } else {
          console.error("Loop error:", error);
          // Errores genéricos, reintento rápido
          setTimeout(() => {
              if (isRunningRef.current) processFrame();
          }, 1000);
        }
      } finally {
        setIsActive(false);
      }
    } else {
      setTimeout(() => {
          if (isRunningRef.current) processFrame();
      }, 500);
    }
  }, [isRateLimited]);

  useEffect(() => {
    if (!isRateLimited && isRunningRef.current) {
       // Loop recovery logic handled by recursive calls
    }
  }, [isRateLimited]);

  useEffect(() => {
    isRunningRef.current = true;
    const timeoutId = setTimeout(() => {
      processFrame();
    }, 1000);
    return () => {
      isRunningRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [processFrame]);

  return (
    <div className="h-dvh w-screen bg-vibe-bg flex flex-col items-center justify-between overflow-hidden relative font-sans">
      
      {/* 
         HEADER: 
         Adaptativo. 
      */}
      <div className={`
        w-full flex flex-col items-center pt-6 pb-2 px-4 z-40 space-y-4 
        bg-gradient-to-b from-vibe-bg to-transparent
        
        /* Landscape Mobile Override */
        landscape:absolute landscape:top-0 landscape:left-0 landscape:flex-row landscape:justify-end landscape:p-4 landscape:space-y-0 landscape:bg-none landscape:pointer-events-none
        
        /* Reset for Desktop */
        md:landscape:relative md:landscape:flex-col md:landscape:items-center md:landscape:justify-start md:landscape:bg-gradient-to-b md:landscape:pt-6 md:landscape:space-y-4 md:landscape:pointer-events-auto
      `}>
        
        {/* Título */}
        <h1 className="text-white/30 font-light tracking-[0.3em] text-[10px] uppercase select-none landscape:hidden md:landscape:block">
          Global Sign Translator <span className="text-vibe-neon opacity-50 ml-1">AI</span>
        </h1>

        {/* Selector de Idioma: Interactuable siempre */}
        <div className="flex bg-white/5 backdrop-blur-md rounded-full p-1 border border-white/10 shadow-lg pointer-events-auto">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setTargetLanguage(lang.code)}
              className={`
                px-5 py-2 rounded-full text-xs font-bold tracking-wider transition-all duration-300
                ${targetLanguage === lang.code 
                  ? 'bg-vibe-neon text-black shadow-[0_0_15px_rgba(0,243,255,0.4)]' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'}
              `}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* 
         MAIN CONTENT
      */}
      <div className="flex-1 w-full max-w-2xl flex flex-col justify-center items-center relative px-0 md:px-4 landscape:max-w-none landscape:h-full">
        
        {/* Contenedor de Cámara con Relación de Aspecto Variable */}
        <div className="relative w-full landscape:h-full md:landscape:h-auto flex flex-col items-center">
          
          <CameraFeed 
            ref={cameraRef} 
            appState={appState} 
            isFlashing={isActive}
            langCode={targetLanguage}
          />

          {/* 
            Alerta API 'Sutil':
            Ubicada como un overlay sobre la parte superior del feed de cámara.
          */}
          {isRateLimited && (
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

        {/* 
           RESULTADOS:
        */}
        <div className="absolute bottom-6 w-full px-4 md:static md:mt-4 md:px-0 z-30 landscape:bottom-2 landscape:w-3/4 landscape:max-w-lg">
          <ResultsDisplay 
            result={translationResult} 
            appState={appState} 
            langCode={targetLanguage}
          />
        </div>
      </div>

      {/* Decoración de Fondo */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-vibe-neon rounded-full blur-[180px] opacity-10 pointer-events-none z-0 landscape:hidden md:landscape:block"></div>
    </div>
  );
};

export default App;