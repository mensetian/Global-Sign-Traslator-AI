export const TRANSLATIONS = {
  Spanish: {
    waiting: "ESPERANDO SEÑAL",
    detected: "DETECTADO",
    searching: "Buscando manos...",
    confidence: "Confianza",
    live: "EN VIVO",
    errorCamera: "NO SE PUDO ACCEDER A LA CÁMARA",
    checkPermissions: "Verifique los permisos de su navegador.",
    apiLimit: "Pausa por límite de API (10s)",
    apiLimitDesc: "Límite de cuota alcanzado",
    reconnecting: "Reconectando...",
    paused: "SISTEMA PAUSADO",
    resume: "REANUDAR",
    pause: "PAUSAR"
  },
  English: {
    waiting: "WAITING FOR SIGNAL",
    detected: "DETECTED",
    searching: "Searching for hands...",
    confidence: "Confidence",
    live: "LIVE",
    errorCamera: "COULD NOT ACCESS CAMERA",
    checkPermissions: "Check your browser permissions.",
    apiLimit: "API Limit reached. Pausing (10s)",
    apiLimitDesc: "Quota limit reached",
    reconnecting: "Reconnecting...",
    paused: "SYSTEM PAUSED",
    resume: "RESUME",
    pause: "PAUSE"
  },
  Portuguese: {
    waiting: "AGUARDANDO SINAL",
    detected: "DETECTADO",
    searching: "Procurando mãos...",
    confidence: "Confiança",
    live: "AO VIVO",
    errorCamera: "NÃO FOI POSSÍVEL ACESSAR A CÂMERA",
    checkPermissions: "Verifique as permissões do navegador.",
    apiLimit: "Limite de API. Pausa (10s)",
    apiLimitDesc: "Limite de cota atingido",
    reconnecting: "Reconectando...",
    paused: "SISTEMA PAUSADO",
    resume: "RETOMAR",
    pause: "PAUSAR"
  }
};

export type LanguageCode = keyof typeof TRANSLATIONS;