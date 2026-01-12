
import { GoogleGenAI } from "@google/genai";
import { Province, Store } from "../types";

// Always use the exact initialization pattern from guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const extractJson = (text: string) => {
  try {
    const match = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    const jsonStr = match ? match[1] : text;
    return JSON.parse(jsonStr.trim());
  } catch (e) {
    console.error("JSON Extraction Error:", e, "Raw Text:", text);
    return null;
  }
};

export const searchStores = async (query: string, userLocation?: { lat: number; lng: number }): Promise<{ 
  stores: Partial<Store>[];
}> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find cannabis stores in Canada for: "${query}". 
      Include both licensed dispensaries AND aboriginal sovereign shops.
      
      Provide a JSON code block containing an array called "stores".
      Each object in "stores" must have:
      - name: string
      - type: "Licensed" or "Aboriginal"
      - address: string
      - province: A string matching one of: Alberta, British Columbia, Manitoba, New Brunswick, Newfoundland and Labrador, Nova Scotia, Northwest Territories, Nunavut, Ontario, Prince Edward Island, Quebec, Saskatchewan, Yukon
      - website: string
      - sourceUrl: string (The URL of the listing or website where this store was found)
      - rating: number
      - featuredOfferings: string[]`,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: userLocation ? { latitude: userLocation.lat, longitude: userLocation.lng } : undefined
          }
        }
      }
    });

    const data = extractJson(response.text || "");
    return { 
      stores: data?.stores || []
    };
  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw error;
  }
};

/**
 * Discovers major retail hubs (cities/towns) in a province to enable targeted syncing.
 */
export const getMajorCities = async (province: Province): Promise<string[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `List the top 5 most populous cities or regions in ${province}, Canada as a JSON array of strings.`,
    config: { responseMimeType: "application/json" }
  });
  try {
    return JSON.parse(response.text);
  } catch (e) {
    return [];
  }
};

export const bulkSyncProvince = async (province: Province, subRegion?: string): Promise<Partial<Store>[]> => {
  const locationTag = subRegion ? `${subRegion}, ${province}` : province;
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `List up to 15 unique cannabis dispensaries in ${locationTag}. 
    Include Licensed stores and Aboriginal/Indigenous shops.
    
    Return as JSON with a "stores" array.
    Required fields: name, type ("Licensed" or "Aboriginal"), address, featuredOfferings (string[]), rating (number), website (string), sourceUrl (string), hours (array of {day, time}).
    
    Format response strictly as a JSON block.`,
    config: {
      tools: [{ googleMaps: {} }, { googleSearch: {} }],
    }
  });

  const data = extractJson(response.text || "");
  return data?.stores || [];
};

export const getStoreInsights = async (storeName: string): Promise<any> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the Canadian cannabis store: "${storeName}". Return JSON with: 
    - atmosphere: string
    - community: string
    - specialties: string
    - sovereignty: string (if applicable)
    - proTip: string
    - hours: array of {day: string, time: string} (Required: Must be an array of objects)`,
    config: { responseMimeType: "application/json" }
  });
  try {
    return JSON.parse(response.text);
  } catch (e) {
    return null;
  }
};
