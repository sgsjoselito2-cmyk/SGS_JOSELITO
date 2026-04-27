import { GoogleGenAI } from "@google/genai";

const getGenAI = () => {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
    if (!apiKey) return null;
    return new GoogleGenAI(apiKey);
};

const generateContentInternal = async (model: any, prompt: string, retries: number): Promise<string> => {
    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return generateContentInternal(model, prompt, retries - 1);
        }
        throw error;
    }
};

export const generateContentWithRetry = async (arg1: any, arg2?: any, arg3 = 3): Promise<any> => {
    // Case: generateContentWithRetry({ model, contents })
    if (arg1 && typeof arg1 === 'object' && !arg1.generateContent) {
        const genAI = getGenAI();
        if (!genAI) return { text: "API Key no configurada." };
        const model = (genAI as any).getGenerativeModel({ model: arg1.model || "gemini-1.5-flash" });
        const text = await generateContentInternal(model, arg1.contents || "", arg3);
        return { text };
    }
    
    // Case: generateContentWithRetry(model, prompt, retries)
    return generateContentInternal(arg1, arg2, arg3);
};

export const analyzeIndicatorsWithAI = async (data: any, objectives: any) => {
    const genAI = getGenAI();
    if (!genAI) return "API Key de Gemini no configurada.";

    try {
        const model = (genAI as any).getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analiza los siguientes indicadores de producción y objetivos:
        ${JSON.stringify(data, null, 2)}
        Objetivos: ${JSON.stringify(objectives, null, 2)}
        Proporciona un resumen ejecutivo breve y 3 acciones recomendadas.`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("AI Analysis Error:", error);
        return "Error al analizar los datos con IA.";
    }
};
