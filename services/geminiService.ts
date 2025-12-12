import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult } from '../types';

// ==========================================
// CONFIGURACIÓN DE MODO DEMO
// ==========================================
const IS_DEMO_MODE = false; 

let demoStartTime = 0;
const ai = !IS_DEMO_MODE ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;

const DEMO_SCRIPTS: Record<string, { t1: string, t2: string, t3: string, t4: string }> = {
  'Spanish': { t1: "Hola", t2: "Hola. ¿Cómo estás?", t3: "Quiero café", t4: "Te amo" },
  'English': { t1: "Hello", t2: "Hello. How are you?", t3: "I want coffee", t4: "I love you" },
  'Portuguese': { t1: "Olá", t2: "Olá. Como vai?", t3: "Quero café", t4: "Eu te amo" }
};

// PROMPT SIMPLIFICADO Y ROBUSTO
const SYSTEM_INSTRUCTION = `
You are an expert Sign Language Translator.
Task: Analyze the sequence of 3 images (video burst) and identify the ASL sign being performed.

Context:
- The user is performing a sign.
- "Previous Context" is the text already translated.

Instructions:
1. Identify the sign clearly (e.g., "Hello", "Thank you", "Family").
2. Return ONLY the translation of the current gesture.
3. If the user is holding the SAME sign as the previous context, repeat the word.
4. If no clear sign is detected (hands down, blurry, nothing), return "...".

Return JSON.
`;

export const sendImageToGemini = async (
  frames: string | string[], 
  targetLanguage: string,
  previousContext: string = ""
): Promise<TranslationResult> => {
  // --- MODO DEMO ---
  if (IS_DEMO_MODE) {
    if (demoStartTime === 0) demoStartTime = Date.now();
    const elapsed = Date.now() - demoStartTime;
    let demoText = "...";
    const script = DEMO_SCRIPTS[targetLanguage] || DEMO_SCRIPTS['Spanish'];

    if (elapsed < 3000) demoText = "..."; 
    else if (elapsed < 7000) demoText = script.t1;
    else if (elapsed < 14000) demoText = script.t2; 
    else if (elapsed < 21000) demoText = script.t3;
    else if (elapsed < 28000) demoText = script.t4; 
    else { demoStartTime = Date.now(); demoText = "..."; }
    
    await new Promise(resolve => setTimeout(resolve, 800));
    return { translation: demoText, confidence: demoText === "..." ? "Low" : "High" } as any;
  }

  // --- MODO PRODUCCIÓN ---
  try {
    if (!ai) throw new Error("Gemini Client not initialized.");

    const framesArray = Array.isArray(frames) ? frames : [frames];
    const contentsParts: any[] = [];

    // Validar frames
    let validFrames = 0;
    framesArray.forEach(frame => {
      if (frame && frame.length > 100) { // Simple check de longitud base64
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
Identify the sign.`
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: { parts: contentsParts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.4, // Un poco más de creatividad ayuda a inferir gestos no perfectos
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
    // CRITICAL FIX: Check if it's a quota error before suppressing it
    const errorMsg = error?.message || error?.toString() || JSON.stringify(error);
    if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota")) {
      console.warn("Quota exceeded in Service, rethrowing...");
      throw error; // Let App.tsx handle the backoff
    }
    
    console.error("Gemini Error (Recoverable):", error);
    return {
      traduccion: "...",
      confianza_modelo: "Low",
      target_language: targetLanguage
    };
  }
};