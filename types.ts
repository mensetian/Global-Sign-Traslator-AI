export interface TranslationResult {
  traduccion: string;
  confianza_modelo: 'High' | 'Medium' | 'Low' | 'Alta' | 'Media' | 'Baja';
  target_language: string;
}

export enum AppState {
  IDLE = 'IDLE',
  CAPTURING = 'CAPTURING',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}