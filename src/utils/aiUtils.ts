import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from "@google/genai";
 
export async function generateContentWithRetry(
  params: GenerateContentParameters,
  maxRetries: number = 5,
  initialDelay: number = 2000
): Promise<GenerateContentResponse> {
  const apiKey = process.env.GEMINI_API_KEY || 
                 (import.meta as any).env?.VITE_GEMINI_API_KEY || 
                 (window as any).process?.env?.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    console.error("GEMINI_API_KEY is missing");
    throw new Error("La clave de API de Gemini no está configurada. Por favor, asegúrate de que GEMINI_API_KEY esté en las variables de entorno.");
  }
 
  const ai = new GoogleGenAI({ apiKey });
  let lastError: any;
 
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent(params);
      return response;
    } catch (error: any) {
      lastError = error;
      
      const isQuotaExceeded = error?.message?.includes('429') || 
                              error?.message?.includes('Quota exceeded') ||
                              error?.message?.includes('Resource has been exhausted');
      
      const isRetryable = (error?.message?.includes('503') || 
                           error?.message?.includes('high demand')) && !isQuotaExceeded;
 
      if (isQuotaExceeded) {
        console.error("Gemini API Quota Exceeded. Stopping retries.");
        throw new Error("Se ha agotado la cuota gratuita de la IA para hoy (límite de 20 peticiones). El análisis automático no estará disponible hasta que se restablezca la cuota.");
      }
 
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }
 
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`AI attempt ${attempt + 1} failed (503/429). Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
 
  throw lastError;
}