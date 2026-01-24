
import { GoogleGenAI, Type } from "@google/genai";
import { GPSPoint } from "../types";

export const generateRouteAnalysis = async (points: GPSPoint[], operator: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analiza la siguiente ruta de recolección de residuos para la empresa REDECOL E.S.P.
    Operador: ${operator}
    Puntos de GPS (lat, lng, timestamp):
    ${points.map(p => `${p.lat}, ${p.lng} @ ${p.timestamp}`).join('\n')}

    Por favor, genera un informe técnico breve que valide:
    1. Cobertura geográfica (¿Parece una ruta lógica?).
    2. Cumplimiento con el Decreto 1381 de 2024 (normativa colombiana de aprovechamiento).
    3. Identifica posibles anomalías en la velocidad o paradas.
    4. Sugerencia de eficiencia operativa.

    Responde en formato JSON con la siguiente estructura:
    {
      "resumen": "string",
      "cumplimientoNormativo": "string",
      "anomalias": ["string"],
      "sugerenciaEficiencia": "string",
      "calificacionRuta": "number (1-10)"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            resumen: { type: Type.STRING },
            cumplimientoNormativo: { type: Type.STRING },
            anomalias: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            sugerenciaEficiencia: { type: Type.STRING },
            calificacionRuta: { type: Type.NUMBER }
          },
          required: ["resumen", "cumplimientoNormativo", "anomalias", "sugerenciaEficiencia", "calificacionRuta"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
