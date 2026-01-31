
import { GoogleGenAI } from "@google/genai";
import { Province, Store } from "../types";

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

export const getVibeRecommendations = async (preferences: any, availableStores: Store[]): Promise<string[]> => {
  const storeContext = availableStores.map(s => ({ id: s.id, name: s.name, type: s.type, offerings: s.featuredOfferings }));
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on these user preferences: ${JSON.stringify(preferences)}, 
    select the IDs of the top 3 most relevant sovereign or local gem shops from this list: ${JSON.stringify(storeContext)}.
    
    Return ONLY a JSON array of string IDs.`,
    config: { responseMimeType: "application/json" }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    return [];
  }
};

export const searchStores = async (query: string, userLocation?: { lat: number; lng: number }): Promise<{ 
  stores: Partial<Store>[];
}> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find niche, independent cannabis shops in Canada for: "${query}". 
      STRICT REQUIREMENT: EXCLUDE all government-licensed corporate dispensaries (e.g., OCS-authorized, BCCS, SQDC corporate stores).
      FOCUS ONLY ON: 
      1. Sovereign Indigenous dispensaries (often located on First Nations land).
      2. Independent "Local Gems" that operate outside the standard corporate retail model.
      
      Provide a JSON code block containing an array called "stores".
      Each object in "stores" must have:
      - name: string
      - type: "Sovereign" or "Local Gem"
      - address: string
      - province: A string matching one of: Alberta, British Columbia, Manitoba, New Brunswick, Newfoundland and Labrador, Nova Scotia, Northwest Territories, Nunavut, Ontario, Prince Edward Island, Quebec, Saskatchewan, Yukon
      - website: string
      - sourceUrl: string
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
    contents: `Identify niche, independent cannabis shops in ${locationTag}. 
    MANDATORY: EXCLUDE all provincially licensed/regulated corporate stores. 
    Focus strictly on Sovereign/Indigenous shops and independent local gems.
    
    Return as JSON with a "stores" array.
    Required fields: name, type ("Sovereign" or "Local Gem"), address, featuredOfferings (string[]), rating (number), website (string), sourceUrl (string), hours (array of {day, time}).
    
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
    contents: `Analyze the niche Canadian cannabis store: "${storeName}". This is an independent or sovereign shop. Return JSON with: 
    - atmosphere: string
    - community: string
    - specialties: string
    - sovereignty: string (explain the indigenous roots or independent status)
    - proTip: string
    - hours: array of {day: string, time: string}`,
    config: { responseMimeType: "application/json" }
  });
  try {
    return JSON.parse(response.text);
  } catch (e) {
    return null;
  }
};