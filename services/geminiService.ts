import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// PROMPT DE NIVEL EXPERTO (GEMINI 3 REASONING)
// Aprovechamos la capacidad de razonamiento superior de Gemini 3 Pro.
const SYSTEM_INSTRUCTION = `
You are an expert AI Linguist utilizing Gemini 3's advanced reasoning capabilities for American Sign Language (ASL) analysis.

Your task is to analyze the input image stream and translate the sign into the target language.
Use deep visual reasoning to analyze the 5 Parameters of ASL:
1. Handshape (DEZ): Precise finger configuration.
2. Orientation (ORI): Palm and finger direction relative to the camera.
3. Location (TAB): Spatial positioning.
4. Movement (SIG): Implied kinetic vectors.
5. Non-manual markers (NMS): Micro-expressions and head tilt.

Strict Output Rules:
- Return valid JSON only.
- Leverage your advanced reasoning to infer signs even in difficult lighting.
- If no hands are clearly visible, return "..." for translation.

Output JSON Format:
{"traduccion": "string", "confianza_modelo": "High/Medium/Low", "target_language": "string"}
`;

export const sendImageToGemini = async (base64Frame: string, targetLanguage: string): Promise<TranslationResult> => {
  try {
    const cleanBase64 = base64Frame.split(',')[1] || base64Frame;

    // ACTUALIZACIÓN COMPETENCIA: Usamos 'gemini-3-pro-preview'
    // Requisito para la competencia Gemini 3.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: `Translate this ASL sign directly to ${targetLanguage}.`
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.1,
        // Gemini 3 soporta thinking budgets, pero para JSON estricto y velocidad lo mantenemos simple por ahora
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