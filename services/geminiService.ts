import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// PROMPT OPTIMIZADO PARA GEMINI 3 FLASH PREVIEW
// Gemini 3 Flash ofrece una capacidad de razonamiento superior manteniendo la baja latencia.
const SYSTEM_INSTRUCTION = `
You are a Sign Language Interpreter.
INPUT: 4 sequential video frames + Previous Context.
OUTPUT: JSON with translation.

METHOD (5 Parameters of ASL):
1. **Handshape:** Look at the fingers.
2. **Orientation:** Palm facing?
3. **Location:** Relative to body.
4. **Movement:** Path of the hand.
5. **Expression:** Face markers.

RULES:
- **Merge:** If the sign fits the previous context, complete the sentence.
- **Precision:** If the movement is unclear or hands are resting/blur, return "...".
- **Strict:** Do not guess. Only translate what is clearly visible.

OUTPUT JSON:
{
  "traduccion": "text",
  "confianza_modelo": "High" | "Low",
  "target_language": "..."
}
`;

export const sendImageToGemini = async (
  frames: string | string[], 
  targetLanguage: string,
  previousContext: string = ""
): Promise<TranslationResult> => {
  try {
    const framesArray = Array.isArray(frames) ? frames : [frames];
    const contentsParts: any[] = [];

    // Validar frames
    let validFrames = 0;
    framesArray.forEach(frame => {
      if (frame && frame.length > 100) { 
        const cleanBase64 = frame.split(',')[1] || frame;
        contentsParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanBase64
          }
        });
        validFrames++;
      }
    });

    if (validFrames === 0) {
        throw new Error("No valid frames to send");
    }

    contentsParts.push({
      text: `Target Language: ${targetLanguage}.
Previous Context: "${previousContext}".
Translate.`
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: { parts: contentsParts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        // AJUSTES DE PRECISIÓN
        temperature: 0.1, 
        topK: 32, 
        topP: 0.8, 
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
    if (!text) throw new Error("Empty response from Gemini");

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText) as TranslationResult;

  } catch (error: any) {
    const errorMsg = error?.message || error?.toString() || JSON.stringify(error);
    if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota")) {
      console.warn("Quota exceeded in Service, rethrowing...");
      throw error; 
    }
    
    console.error("Gemini Error:", error);
    return {
      traduccion: "...",
      confianza_modelo: "Low",
      target_language: targetLanguage
    };
  }
};