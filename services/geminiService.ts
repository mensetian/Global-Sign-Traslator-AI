import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult } from '../types';

// ==========================================
// CONFIGURACIÓN DE MODO DEMO (PROMO VIDEO)
// ==========================================
const IS_DEMO_MODE = true; // Set to FALSE for production

// Variable para controlar la secuencia de tiempo del demo
let demoStartTime = 0;

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// PROMPT AVANZADO: GESTIÓN ESTRICTA DE CONTEXTO
const SYSTEM_INSTRUCTION = `
You are a professional ASL interpreter analyzing a BURST SEQUENCE (3 frames).

INPUTS:
1. IMAGES: A short video sequence (3 frames ~400ms). Detect motion vs static hold.
2. PREVIOUS CONTEXT: The text currently displayed on screen.

YOUR GOAL: Output the UPDATED text string.

RULES FOR CONTEXT MANAGEMENT (CRITICAL):
1. **APPEND vs. MERGE**: 
   - If the new sign grammatically flows from the Context (e.g., Context="I", Sign="Want" -> Result="I want"), merge them.
   - If the new sign is a NEW idea (e.g., Context="Hello", Sign="Coffee" -> Result="Hello. Coffee"), use PUNCTUATION to separate.
   
2. **NO HALLUCINATIONS**: 
   - Do NOT add words that were not signed (like "please", "am", "the") unless absolutely required for basic grammar. 
   - Do NOT re-interpret the "Previous Context" if the new sign is unrelated. Keep the old text as is and append the new one.

3. **HOLDING SIGNS**: 
   - If the gesture in the frames is IDENTICAL to the gesture that created the "Previous Context" (user is just holding the hand up), return the "Previous Context" UNCHANGED. Do not repeat the word.

4. **CORRECTIONS**:
   - If the user shakes their head or waves hand dismissively, clear the last word.

Output JSON Format:
{"traduccion": "string (The FULL updated sentence)", "confianza_modelo": "High/Medium/Low", "target_language": "string"}
`;

export const sendImageToGemini = async (
  frames: string | string[], 
  targetLanguage: string,
  previousContext: string = ""
): Promise<TranslationResult> => {
  // ---------------------------------------------------------
  // LÓGICA DE MODO DEMO
  // ---------------------------------------------------------
  if (IS_DEMO_MODE) {
    if (demoStartTime === 0) demoStartTime = Date.now();
    const elapsed = Date.now() - demoStartTime;
    let demoText = "";

    // Secuencia ajustada para parecer más natural y separada
    if (elapsed < 3000) demoText = "..."; 
    else if (elapsed < 8000) demoText = "Hola";
    else if (elapsed < 15000) demoText = "Hola. ¿Cómo estás?"; // Muestra acumulación con puntuación
    else if (elapsed < 22000) demoText = "Hola. ¿Cómo estás? Quiero café";
    else { demoStartTime = Date.now(); demoText = "..."; }
    
    await new Promise(resolve => setTimeout(resolve, 800));

    return {
      traduccion: demoText,
      confianza_modelo: demoText === "..." ? "Low" : "High",
      target_language: targetLanguage
    };
  }

  // ---------------------------------------------------------
  // LÓGICA DE PRODUCCIÓN
  // ---------------------------------------------------------
  try {
    const framesArray = Array.isArray(frames) ? frames : [frames];
    const contentsParts: any[] = [];

    framesArray.forEach(frame => {
      const cleanBase64 = frame.split(',')[1] || frame;
      contentsParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      });
    });

    contentsParts.push({
      text: `Target Language: ${targetLanguage}.
Current Displayed Text (Context): "${previousContext}".
ACTION: Analyze frames. Decide to HOLD (return context), MERGE (add word), or SPLIT (add punctuation + word).`
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: { parts: contentsParts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.1, // BAJAMOS TEMPERATURA: Queremos precisión, no creatividad.
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
    const errString = error.toString().toLowerCase();
    if (errString.includes('429') || errString.includes('quota')) {
      throw error; 
    }

    console.warn("Gemini Analysis non-critical error:", error);
    return {
      traduccion: previousContext || "...",
      confianza_modelo: "Low",
      target_language: targetLanguage
    };
  }
};