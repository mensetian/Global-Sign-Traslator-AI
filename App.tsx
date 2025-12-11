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
  
  // INICIO SEGURO: Empezamos en PAUSA para no gastar cuota al cargar la página.
  const [isPaused, setIsPaused] = useState(true); 
  
  // REF CRÍTICA: Mantiene el estado de pausa actualizado dentro de los timeouts asíncronos
  const isPausedRef = useRef(isPaused);
  
  const cameraRef = useRef<CameraFeedHandle>(null);
  const isRunningRef = useRef(true);
  const languageRef = useRef(targetLanguage);

  // Get current translation object
  const t = TRANSLATIONS[targetLanguage as LanguageCode] || TRANSLATIONS.Spanish;

  // Sincronizar refs
  useEffect(() => {
    languageRef.current = targetLanguage;
  }, [targetLanguage]);

  useEffect(() => {
    isPausedRef.current = isPaused;
    
    // Si quitamos la pausa, iniciamos el ciclo inmediatamente
    if (!isPaused) {
      setAppState(AppState.ANALYZING);
      processFrame();
    } else {
      setAppState(AppState.IDLE);
      setIsActive(false);
    }
  }, [isPaused]);

  const processFrame = useCallback(async () => {
    // CHEQUEO DE SEGURIDAD 1: Si la app se desmontó o está pausada (vía Ref), abortar.
    if (!isRunningRef.current || isPausedRef.current) return;
    
    // Si estamos limitados por la API, no hacemos nada (el timeout de reintento lo manejará)
    if (isRateLimited) return;

    const imageSrc = cameraRef.current?.captureFrame();

    if (imageSrc) {
      setIsActive(true); 
      setAppState(AppState.ANALYZING);
      const startTime = Date.now();

      try {
        const result = await sendImageToGemini(imageSrc, languageRef.current);
        
        // CHEQUEO DE SEGURIDAD 2: El usuario pudo haber pausado MIENTRAS esperábamos a Gemini
        if (isPausedRef.current) {
             setIsActive(false);
             setAppState(AppState.IDLE);
             return; // Matar el ciclo aquí
        }
        
        // Actualizamos el resultado si es válido
        if (result.traduccion !== "..." && result.traduccion.trim() !== "") {
             setTranslationResult(result);
        } else {
             // Si Gemini devuelve "..." (vacío), no borramos el resultado anterior inmediatamente.
        }
        setAppState(AppState.SUCCESS);

        const elapsed = Date.now() - startTime;
        
        // OPTIMIZACIÓN: Gemini 2.5 Flash es rápido. Reducimos el delay.
        // 500ms para sensación de tiempo real.
        const minimumDelay = 500; 
        const nextDelay = Math.max(0, minimumDelay - elapsed);

        setTimeout(() => {
            // CHEQUEO DE SEGURIDAD 3: Verificar Ref antes de reiniciar
            if (isRunningRef.current && !isPausedRef.current) processFrame();
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
          console.warn("Cuota de API excedida (429).");
          setIsRateLimited(true);
          
          // Lógica de reintento con verificación de PAUSA
          setTimeout(() => {
            setIsRateLimited(false);
            // Solo reintentamos si el usuario NO ha pausado durante el tiempo de espera
            if (isRunningRef.current && !isPausedRef.current) {
                processFrame();
            }
          }, 10000); // 10 segundos de enfriamiento
        } else {
          console.error("Loop error:", error);
          setTimeout(() => {
              if (isRunningRef.current && !isPausedRef.current) processFrame();
          }, 1000);
        }
      } finally {
        if (!isPausedRef.current) {
            setIsActive(false);
        }
      }
    } else {
      // Si la cámara no está lista, reintentar rápido
      setTimeout(() => {
          if (isRunningRef.current && !isPausedRef.current) processFrame();
      }, 500);
    }
  }, [isRateLimited]); // Dependencias mínimas, usamos Refs para lo demás

  // Cleanup al desmontar
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

        {/* CONTROLES SUPERIORES: Solo Idioma ahora */}
        <div className="flex items-center gap-4 pointer-events-auto">
          
          {/* Selector de Idioma (Pill Shape) */}
          <div className="flex bg-white/5 backdrop-blur-md rounded-full p-1 border border-white/10 shadow-lg">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setTargetLanguage(lang.code)}
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
      <div className="flex-1 w-full max-w-2xl flex flex-col justify-center items-center relative px-0 md:px-4 landscape:max-w-none landscape:h-full">
        
        <div className="relative w-full landscape:h-full md:landscape:h-auto flex flex-col items-center group">
          
          <CameraFeed 
            ref={cameraRef} 
            appState={appState} 
            isFlashing={isActive}
            langCode={targetLanguage}
          />

          {/* BOTÓN DE CONTROL SOBRE EL VIDEO (Sutil y Esquina Superior Derecha) */}
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={() => setIsPaused(!isPaused)}
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
                // Icono de PAUSA (Sutil)
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                </svg>
              ) : (
                // Icono de PLAY (Sutil)
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5">
                   <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>

          {/* OVERLAY DE PAUSA (Minimalista) */}
          {isPaused && (
             <div className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[2px] rounded-3xl transition-all duration-500">
                <div className="bg-black/40 px-6 py-2 rounded-full border border-white/5">
                  <p className="text-white/50 text-xs tracking-[0.3em] font-light animate-pulse">{t.paused}</p>
                </div>
             </div>
          )}

          {/* Alerta API 'Sutil' */}
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
        <div className="absolute bottom-6 w-full px-4 md:static md:mt-4 md:px-0 z-30 landscape:bottom-2 landscape:w-3/4 landscape:max-w-lg">
          <ResultsDisplay 
            result={translationResult} 
            appState={appState} 
            langCode={targetLanguage}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-vibe-neon rounded-full blur-[180px] opacity-10 pointer-events-none z-0 landscape:hidden md:landscape:block"></div>
    </div>
  );
};

export default App;