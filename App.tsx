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

// --- CALIBRACIÓN DE FLUJO "RELAJADO" ---
const THRESHOLD_START = 0.5; 

// Umbral ultra-bajo: La barra tiene que estar prácticamente vacía (3%)
const THRESHOLD_SILENCE = 0.03; 

// TIEMPO DE PAUSA REAL: 1.5 Segundos
// Tienes que quedarte quieto 1.5s para que el sistema diga "Ok, terminó".
const SILENCE_DURATION = 1500; 

// Buffer para ignorar parpadeos de la cámara (Motion Blur)
const HANDS_LOST_BUFFER = 400; 

const MAX_RECORDING_DURATION = 10000; 

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('Spanish');
  const [isActive, setIsActive] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  // Feedback Visual
  const [debugVelocity, setDebugVelocity] = useState(0); 
  const [sessionFramesCount, setSessionFramesCount] = useState(0);

  const [isPaused, setIsPaused] = useState(false); 
  const isPausedRef = useRef(isPaused);
  const cameraRef = useRef<CameraFeedHandle>(null);
  const languageRef = useRef(targetLanguage);
  
  const lastTextRef = useRef("");
  const lastTranslationTimeRef = useRef<number>(Date.now());

  // --- MÁQUINA DE ESTADOS ---
  const isRecordingRef = useRef<boolean>(false);
  const recordingStartTimeRef = useRef<number>(0);
  
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handsLostTimerRef = useRef<number>(0); // Timestamp de cuando se perdieron las manos
  
  const sessionFramesRef = useRef<string[]>([]);
  const lastCaptureTimeRef = useRef<number>(0);
  const processingRef = useRef(false);

  const t = TRANSLATIONS[targetLanguage as LanguageCode] || TRANSLATIONS.Spanish;

  useEffect(() => {
    languageRef.current = targetLanguage;
  }, [targetLanguage]);
  
  useEffect(() => {
    isPausedRef.current = isPaused;
    if (isPaused) {
      setAppState(AppState.IDLE);
      setIsActive(false);
      resetSession();
    } else {
        setAppState(AppState.IDLE);
    }
  }, [isPaused]);

  const resetSession = () => {
      sessionFramesRef.current = [];
      isRecordingRef.current = false;
      recordingStartTimeRef.current = 0;
      setSessionFramesCount(0);
      handsLostTimerRef.current = 0;
      
      if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
      }
  };

  // --- LOOP PRINCIPAL (30ms) ---
  useEffect(() => {
    const intervalId = setInterval(() => {
        if (isPausedRef.current || isRateLimited || processingRef.current) return;
        if (!cameraRef.current) return;

        const rawHandDetected = cameraRef.current.isHandDetected;
        const velocity = cameraRef.current.getHandVelocity();
        const now = Date.now();
        
        setDebugVelocity(velocity);
        setSessionFramesCount(sessionFramesRef.current.length);

        // ==========================================================
        // 1. GESTIÓN DE PÉRDIDA DE RASTREO (ANTI-FLICKER)
        // ==========================================================
        let effectiveHandDetected = rawHandDetected;

        if (!rawHandDetected) {
            // Si acabamos de perder las manos, marcamos el tiempo
            if (handsLostTimerRef.current === 0) {
                handsLostTimerRef.current = now;
            }
            
            // Si ha pasado poco tiempo, FINGIMOS que las manos siguen ahí
            // Esto evita cortes por movimiento rápido (motion blur)
            if (now - handsLostTimerRef.current < HANDS_LOST_BUFFER) {
                effectiveHandDetected = true; 
            }
        } else {
            // Si volvieron las manos, reseteamos el timer de pérdida
            handsLostTimerRef.current = 0;
        }

        // ==========================================================
        // 2. LÓGICA DE DETECCIÓN DE FINAL (MANOS BAJADAS REALMENTE)
        // ==========================================================
        if (!effectiveHandDetected) {
             // Solo si las manos se han ido por MÁS de 400ms confirmamos la salida
             if (isRecordingRef.current && sessionFramesRef.current.length >= 2) {
                 triggerTranslation("HANDS_EXIT_CONFIRMED");
             } else {
                 if (sessionFramesRef.current.length > 0) resetSession();
             }
             return; // Salimos del loop, no capturamos frames vacíos
        }

        // ==========================================================
        // 3. LÓGICA DE GRABACIÓN
        // ==========================================================
        
        if (isRecordingRef.current) {
            // --- ESTAMOS GRABANDO ---

            // A. Captura Frames
            if (now - lastCaptureTimeRef.current > 70) { 
                const frame = cameraRef.current.captureFrame();
                if (frame) {
                    sessionFramesRef.current.push(frame);
                    if (sessionFramesRef.current.length > 25) {
                         sessionFramesRef.current.splice(1, 1); 
                    }
                    lastCaptureTimeRef.current = now;
                }
            }

            // B. Chequeo de Movimiento (LA BARRA)
            // Usamos 0.03 como umbral. Si te mueves, reiniciamos el timer.
            if (velocity > THRESHOLD_SILENCE) {
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                }
            } else {
                // BARRA VACÍA: Iniciamos cuenta atrás
                if (!silenceTimerRef.current) {
                    silenceTimerRef.current = setTimeout(() => {
                        triggerTranslation("SILENCE_TIMEOUT");
                    }, SILENCE_DURATION);
                }
            }

            // C. Timeout máximo
            if (now - recordingStartTimeRef.current > MAX_RECORDING_DURATION) {
                triggerTranslation("MAX_DURATION");
            }

        } else {
            // --- ESTADO IDLE ---
            // Solo empezamos si hay un movimiento decidido
            if (velocity > THRESHOLD_START) {
                isRecordingRef.current = true;
                recordingStartTimeRef.current = now;
                setAppState(AppState.CAPTURING);

                const frame = cameraRef.current.captureFrame();
                if (frame) sessionFramesRef.current = [frame];
                lastCaptureTimeRef.current = now;
            }
        }

    }, 30);

    return () => clearInterval(intervalId);
  }, [isPaused, isRateLimited, appState]);


  const triggerTranslation = async (triggerSource: string) => {
      // Limpiar timers
      if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
      }
      handsLostTimerRef.current = 0;

      if (processingRef.current) return;
      
      const frames = sessionFramesRef.current;
      
      // Filtro de ruido
      if (frames.length < 3) {
          resetSession();
          setAppState(AppState.IDLE);
          return;
      }

      processingRef.current = true;
      setIsActive(true);
      setAppState(AppState.ANALYZING);

      try {
          // MUESTREO DE FRAMES
          let payloadFrames: string[] = [];
          
          if (frames.length <= 4) {
              payloadFrames = frames;
          } else {
              // 4 Frames distribuidos
              payloadFrames = [
                  frames[0], 
                  frames[Math.floor(frames.length * 0.33)], 
                  frames[Math.floor(frames.length * 0.66)], 
                  frames[frames.length - 1] 
              ];
          }

          console.log(`Trigger [${triggerSource}]: Sending ${payloadFrames.length} frames.`);

          resetSession();

          let safeContext = lastTextRef.current;
          const timeSinceLast = Date.now() - lastTranslationTimeRef.current;
          if (timeSinceLast > 15000) safeContext = ""; 
          
          const words = safeContext.split(' ').filter(w => w.length > 0);
          if (words.length > 30) safeContext = "..." + words.slice(-30).join(' ');

          const result = await sendImageToGemini(payloadFrames, languageRef.current, safeContext);

          if (isPausedRef.current) return;

          if (result.traduccion && result.traduccion !== "..." && result.traduccion.trim().length > 0) {
              setTranslationResult(result);
              
              const cleanNew = result.traduccion.trim();
              const cleanOld = safeContext.replace('...', '').trim();
              
              if (cleanNew.length >= cleanOld.length && cleanNew !== cleanOld) {
                  lastTextRef.current = result.traduccion;
                  lastTranslationTimeRef.current = Date.now();
              }
              setAppState(AppState.SUCCESS);
          } else {
             setAppState(AppState.IDLE);
          }

      } catch (error: any) {
         console.error(error);
         const errString = error?.message || "";
         if (errString.includes('429')) {
             setIsRateLimited(true);
             setTimeout(() => setIsRateLimited(false), 10000);
         }
         setAppState(AppState.ERROR);
      } finally {
          setIsActive(false);
          processingRef.current = false;
          setTimeout(() => {
               if (!processingRef.current) setAppState(AppState.IDLE);
          }, 300);
      }
  };


  return (
    <div className="h-dvh w-screen bg-vibe-bg flex flex-col items-center justify-between overflow-hidden relative font-sans">
      
      {/* HEADER */}
      <div className={`
        w-full flex flex-col items-center pt-6 pb-2 px-4 z-40 space-y-4 
        bg-gradient-to-b from-vibe-bg to-transparent
        landscape:absolute landscape:top-0 landscape:left-0 landscape:flex-row landscape:justify-end landscape:p-4 landscape:space-y-0 landscape:bg-none landscape:pointer-events-none
        md:landscape:relative md:landscape:flex-col md:landscape:items-center md:landscape:justify-start md:landscape:bg-gradient-to-b md:landscape:pt-6 md:landscape:space-y-4 md:landscape:pointer-events-auto
      `}>
        <h1 className="text-white/30 font-light tracking-[0.3em] text-[10px] uppercase select-none landscape:hidden md:landscape:block text-center">
          Global Sign Translator <span className="block md:inline text-[9px] text-vibe-neon opacity-70 mt-1 md:mt-0 md:ml-2">Build with Gemini 3</span>
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

          {/* INDICADOR KINETICO DEBUG */}
          <div className="absolute top-16 left-4 z-50 flex flex-col gap-1 pointer-events-none transition-opacity duration-300">
             
             {/* Barra de Velocidad */}
             <div className="flex gap-1 h-1 w-24 bg-black/60 backdrop-blur rounded-full overflow-hidden border border-white/10 relative">
                 {/* Marca de umbral */}
                <div className="absolute left-[3%] top-0 bottom-0 w-0.5 bg-red-500/50 z-10"></div>
                <div 
                    className={`h-full transition-all duration-75 ease-out ${debugVelocity > THRESHOLD_START ? 'bg-vibe-neon' : (debugVelocity > THRESHOLD_SILENCE ? 'bg-blue-400' : (silenceTimerRef.current ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'))}`}
                    style={{ width: `${Math.min(100, debugVelocity * 30)}%` }}
                />
             </div>
             
             {/* Indicador de grabación de frames */}
             <div className="flex gap-0.5 mt-1 h-1 w-24">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div 
                        key={i} 
                        className={`flex-1 rounded-sm transition-colors duration-100 ${i < sessionFramesCount ? 'bg-red-500' : 'bg-white/5'}`}
                    />
                ))}
             </div>
             
             {/* Text Status */}
             <div className="flex justify-between w-24 mt-0.5">
               <span className="text-[7px] text-white/40 tracking-widest uppercase">REC</span>
               <span className={`text-[7px] tracking-widest uppercase font-bold 
                 ${processingRef.current ? 'text-vibe-neon animate-pulse' : (silenceTimerRef.current ? 'text-yellow-400' : (isRecordingRef.current ? 'text-red-500' : 'text-white/20'))}
               `}>
                 {processingRef.current ? 'THINKING' : (silenceTimerRef.current ? 'WAITING...' : (isRecordingRef.current ? 'RECORDING' : 'IDLE'))}
               </span>
             </div>
          </div>

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