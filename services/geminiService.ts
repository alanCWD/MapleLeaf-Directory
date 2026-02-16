
import { GoogleGenAI } from "@google/genai";
import { Province, Store } from "../types";

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured. Please set it in the Secrets tab.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

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
  
  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Based on these user preferences: ${JSON.stringify(preferences)}, 
    select the IDs of the top 3 most relevant sovereign or local gem shops from this list: ${JSON.stringify(storeContext)}.
    
    IMPORTANT: Only return IDs that exist in the provided list. Do NOT invent new store IDs.
    Return ONLY a JSON array of string IDs.`,
    config: { responseMimeType: "application/json" }
  });

  try {
    const ids = JSON.parse(response.text);
    return ids.filter((id: string) => availableStores.some(s => s.id === id));
  } catch (e) {
    return [];
  }
};

const ANTI_HALLUCINATION_PROMPT = `
CRITICAL RULES - READ CAREFULLY:
1. ONLY return locations that you can verify exist through Google Maps, Google Search, social media, news articles, community forums, or other grounding tools.
2. If you cannot find ANY real evidence for a store, DO NOT include it. Never invent store names or addresses.
3. Every store MUST have a real, verifiable address or identifiable location description (e.g. "Highway 97A, Enderby, BC" is acceptable for informal shops).
4. If no results can be found with sufficient evidence, return an EMPTY stores array: {"stores": []}
5. For each store, include a "sourceUrl" linking to a real web page that references this business. Acceptable sources include: directory listings, news articles, social media pages (Facebook, Instagram), Google Maps links, community forums, Reddit posts, or blog mentions.
6. Do NOT fabricate URLs or source references.
7. If you are uncertain whether a location is real, DO NOT include it.

IMPORTANT - SOVEREIGN & UNLICENSED SHOPS:
- Many sovereign Indigenous shops and trading posts are NOT on Google Maps and may NOT have websites.
- These shops are STILL REAL and should be included if you find ANY evidence (news articles, social media, community reports, blog posts, Reddit threads, etc.).
- Unlicensed dispensaries, trading posts, and smoke shops on First Nations land are a KEY part of this directory.
- Do NOT exclude a shop just because it lacks a Google Maps listing or website. Social media presence or news coverage is sufficient evidence.
- For sovereign shops without formal addresses, use descriptive locations (e.g. "Highway 97A near Enderby, BC").
`;

export const searchStores = async (query: string, userLocation?: { lat: number; lng: number }): Promise<{ 
  stores: Partial<Store>[];
}> => {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${ANTI_HALLUCINATION_PROMPT}

Find niche, independent cannabis shops in Canada for: "${query}". 
STRICT REQUIREMENT: EXCLUDE all government-licensed corporate dispensaries (e.g., OCS-authorized, BCCS, SQDC corporate stores).
FOCUS ONLY ON: 
1. Sovereign Indigenous dispensaries, trading posts, and smoke shops (often located on First Nations land or reserves). These may be unlicensed and operate under Indigenous sovereignty.
2. Independent "Local Gems" that operate outside the standard corporate retail model.
3. Unlicensed trading posts and informal dispensaries that are known in local communities.
NOTE: Many of these shops will NOT appear on Google Maps. Search news articles, social media, Reddit, community forums, and local blogs for evidence.

Return a JSON code block with a "stores" array. If NO verifiable stores are found, return {"stores": []}.
Each object in "stores" must have:
- name: string (exact real business name as found in evidence)
- type: "Sovereign" or "Local Gem"
- address: string (real street address if known, OR a descriptive location like "Highway 97A near Enderby, BC" for informal/sovereign shops)
- province: A string matching one of: Alberta, British Columbia, Manitoba, New Brunswick, Newfoundland and Labrador, Nova Scotia, Northwest Territories, Nunavut, Ontario, Prince Edward Island, Quebec, Saskatchewan, Yukon
- website: string (real URL, social media page URL, or empty string if not found)
- sourceUrl: string (URL to evidence page - news articles, social media, forums, community posts all count)
- rating: number (real rating if found, 0 if unknown)
- featuredOfferings: string[] (only if verifiable)
- hours: array of {day: string, time: string} (only if verifiable, empty array otherwise)`,
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
    if (!data?.stores || !Array.isArray(data.stores)) {
      return { stores: [] };
    }
    
    const validStores = data.stores.filter((s: any) => 
      s.name && s.name.trim() !== '' && 
      s.address && s.address.trim() !== ''
    );
    
    return { stores: validStores };
  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw error;
  }
};

export const getMajorCities = async (province: Province): Promise<string[]> => {
  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
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
  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${ANTI_HALLUCINATION_PROMPT}

Identify niche, independent cannabis shops in ${locationTag}. 
MANDATORY: EXCLUDE all provincially licensed/regulated corporate stores. 
Focus strictly on:
1. Sovereign/Indigenous shops, trading posts, and smoke shops (including unlicensed ones operating on First Nations land)
2. Independent local gems operating outside the corporate retail model
3. Unlicensed dispensaries and trading posts known in local communities

IMPORTANT: Many sovereign and trading post shops will NOT appear on Google Maps. 
Search news articles, social media (Facebook, Instagram), Reddit, community forums, and local blogs.
A Facebook page, news article, or community mention is sufficient evidence for inclusion.

Return a JSON code block with a "stores" array. If NO verifiable stores exist, return {"stores": []}.
Required fields per store:
- name: string (exact real business name)
- type: "Sovereign" or "Local Gem"
- address: string (real verified address, or descriptive location like "Highway 97A near Enderby, BC" for informal shops)
- featuredOfferings: string[] (only verifiable items)
- rating: number (real rating or 0)
- website: string (real URL, social media page URL, or empty string)
- sourceUrl: string (URL to evidence confirming this business - news articles, social media, forums all count)
- hours: array of {day: string, time: string} (verifiable hours or empty array)

Do NOT include any store you cannot find ANY evidence for through the grounding tools.`,
    config: {
      tools: [{ googleMaps: {} }, { googleSearch: {} }],
    }
  });

  const data = extractJson(response.text || "");
  if (!data?.stores || !Array.isArray(data.stores)) {
    return [];
  }
  
  return data.stores.filter((s: any) => 
    s.name && s.name.trim() !== '' && 
    s.address && s.address.trim() !== ''
  );
};

export const getStoreInsights = async (storeName: string): Promise<any> => {
  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Analyze the niche Canadian cannabis store: "${storeName}". This is an independent or sovereign shop. 
    
IMPORTANT: Only provide information you can verify. If you cannot find real information about this store, return null values for unknown fields.

Return JSON with: 
- atmosphere: string (or null if unknown)
- community: string (or null if unknown)
- specialties: string (or null if unknown)
- sovereignty: string (explain the indigenous roots or independent status, or null if unknown)
- proTip: string (or null if unknown)
- hours: array of {day: string, time: string} (only if verifiable, empty array otherwise)`,
    config: { responseMimeType: "application/json" }
  });
  try {
    return JSON.parse(response.text);
  } catch (e) {
    return null;
  }
};
