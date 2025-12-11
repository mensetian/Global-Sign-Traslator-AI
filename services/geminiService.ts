import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// PROMPT OPTIMIZADO
const SYSTEM_INSTRUCTION = `
You are a real-time ASL interpreter.
Analyze the hand gestures in the image instantly.

Key Rules:
1. Translate the sign to the target language.
2. If the sign is ambiguous, make your best guess based on common ASL signs.
3. If hands are present but not signing, describe the handshape briefly or return "...".
4. ONLY return "..." if absolutely NO hands are visible.

Output JSON Format:
{"traduccion": "string", "confianza_modelo": "High/Medium/Low", "target_language": "string"}
`;

export const sendImageToGemini = async (base64Frame: string, targetLanguage: string): Promise<TranslationResult> => {
  try {
    const cleanBase64 = base64Frame.split(',')[1] || base64Frame;

    // ACTUALIZACIÓN: Usamos 'gemini-2.5-flash' para velocidad.
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
            text: `Translate ASL sign to ${targetLanguage}`
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.4,
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
    return {
      traduccion: "...",
      confianza_modelo: "Low",
      target_language: targetLanguage
    };
  }
};