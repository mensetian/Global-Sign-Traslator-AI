import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Prompt optimizado para velocidad
const SYSTEM_INSTRUCTION = `
You are a high-speed ASL interpreter. 
1. Identify the ASL sign in the image immediately.
2. Translate to the target language.
3. If uncertain or no hand is visible, return "..." for translation.
4. Keep confidence assessment strict but fast.

Output JSON only.
`;

export const sendImageToGemini = async (base64Frame: string, targetLanguage: string): Promise<TranslationResult> => {
  try {
    const cleanBase64 = base64Frame.split(',')[1] || base64Frame;

    // Usamos 'gemini-2.5-flash' para velocidad
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: `Translate ASL sign to ${targetLanguage}.`
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            traduccion: { type: Type.STRING },
            confianza_modelo: { type: Type.STRING },
            target_language: { type: Type.STRING }
          },
          required: ["traduccion", "confianza_modelo", "target_language"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");

    return JSON.parse(text) as TranslationResult;

  } catch (error: any) {
    // CRITICAL: Propagate 429/Quota errors so App.tsx can handle backoff
    // Handle various error structures (Error object, JSON object from SDK, etc.)
    const errString = error.toString().toLowerCase();
    const isRateLimit = 
      errString.includes('429') || 
      errString.includes('quota') || 
      errString.includes('resource_exhausted') ||
      error?.status === 429 ||
      error?.error?.code === 429 ||
      error?.response?.status === 429;

    if (isRateLimit) {
      throw error; 
    }

    console.warn("Gemini Analysis non-critical error:", error);
    // Para otros errores, fallamos silenciosamente para mantener la UI fluida
    return {
      traduccion: "...",
      confianza_modelo: "Low",
      target_language: targetLanguage
    };
  }
};