import React, { useEffect, useState } from 'react';
import { TranslationResult, AppState } from '../types';
import { TRANSLATIONS, LanguageCode } from '../utils/translations';

interface ResultsDisplayProps {
  result: TranslationResult | null;
  appState: AppState;
  langCode: string;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ result, appState, langCode }) => {
  const [animate, setAnimate] = useState(false);
  
  const t = TRANSLATIONS[langCode as LanguageCode] || TRANSLATIONS.Spanish;

  // Consideramos que hay resultado solo si hay texto y no es el placeholder de error
  const hasResult = !!result && result.traduccion !== "..." && result.traduccion.trim() !== "";
  
  // Trigger animation effect on new result
  useEffect(() => {
    if (hasResult) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 200);
      return () => clearTimeout(timer);
    }
  }, [result?.traduccion, hasResult]);

  // Case-insensitive confidence check
  const confidence = result?.confianza_modelo?.toLowerCase() || 'low';
  const isHighConfidence = confidence === 'high' || confidence === 'alta';

  // Dynamic Styles
  const borderColor = hasResult 
    ? (isHighConfidence ? 'border-vibe-neon/50 shadow-[0_0_30px_rgba(0,243,255,0.15)]' : 'border-yellow-400/50 shadow-[0_0_20px_rgba(250,204,21,0.15)]')
    : 'border-white/5';
    
  const bgGradient = hasResult
    ? 'bg-gradient-to-b from-gray-900/80 to-black/90'
    : 'bg-black/40';

  return (
    <div className="w-full max-w-xl mx-auto px-4 z-50">
      <div className={`
        relative overflow-hidden rounded-3xl backdrop-blur-xl 
        border ${borderColor} ${bgGradient}
        transition-all duration-300 ease-out
        ${animate ? 'scale-[1.02] brightness-125' : 'scale-100 brightness-100'}
        flex flex-col min-h-[160px] shadow-2xl
      `}>
        
        {/* Decorative Grid Texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        </div>

        {/* Top Bar: Label & Confidence Meter */}
        <div className="flex justify-between items-center px-6 py-3 border-b border-white/5 bg-white/5">
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/30 uppercase flex items-center gap-2">
            {hasResult ? (
              <>
                <span className={`w-1.5 h-1.5 rounded-full ${isHighConfidence ? 'bg-vibe-neon' : 'bg-yellow-400'} animate-pulse`}></span>
                {t.detected}
              </>
            ) : t.waiting}
          </span>
          
          {/* Signal Strength Indicator */}
          <div className="flex items-end gap-1 h-3" title={`${t.confidence}: ${result?.confianza_modelo || 'N/A'}`}>
             <div className={`w-1 rounded-sm transition-all duration-300 ${hasResult ? (isHighConfidence ? 'bg-vibe-neon h-2' : 'bg-yellow-400 h-2') : 'bg-white/10 h-1'}`}></div>
             <div className={`w-1 rounded-sm transition-all duration-300 ${hasResult ? (isHighConfidence ? 'bg-vibe-neon h-3' : 'bg-white/20 h-1') : 'bg-white/10 h-1'}`}></div>
             <div className={`w-1 rounded-sm transition-all duration-300 ${hasResult ? (isHighConfidence ? 'bg-vibe-neon h-[100%]' : 'bg-white/10 h-1') : 'bg-white/10 h-1'}`}></div>
          </div>
        </div>

        {/* Main Text Content */}
        <div className="flex-1 flex items-center justify-center p-6 text-center relative z-10">
          {hasResult ? (
            <div className="relative">
              <p className={`
                text-3xl md:text-5xl font-medium tracking-tight text-white drop-shadow-md
                transition-all duration-200
                ${animate ? 'opacity-90 blur-[1px]' : 'opacity-100 blur-0'}
              `}>
                {result?.traduccion}
              </p>
              {/* Reflection/Glow under text */}
              <p className="absolute top-full left-0 right-0 text-3xl md:text-5xl font-medium tracking-tight text-white opacity-10 blur-sm scale-y-[-0.5] pointer-events-none select-none">
                {result?.traduccion}
              </p>
            </div>
          ) : (
             // Empty State: Scanning Animation
             <div className="flex flex-col items-center gap-4 opacity-40">
                <div className="relative flex items-center justify-center w-12 h-12">
                   <div className="absolute inset-0 border-2 border-vibe-neon/30 rounded-full animate-ping"></div>
                   <div className="absolute inset-0 border-2 border-t-vibe-neon border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                </div>
                <span className="text-xs font-mono uppercase tracking-widest text-vibe-neon/80 animate-pulse">
                  {t.searching}
                </span>
             </div>
          )}
        </div>

        {/* Bottom Status Bar / Progress Line */}
        {hasResult && (
           <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
              <div 
                className={`h-full transition-all duration-500 ease-out ${isHighConfidence ? 'bg-vibe-neon shadow-[0_0_10px_#00f3ff]' : 'bg-yellow-400'}`}
                style={{ width: '100%' }}
              ></div>
           </div>
        )}
      </div>
    </div>
  );
};

export default ResultsDisplay;