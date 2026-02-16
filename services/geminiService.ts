
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

const STORE_FIELDS_PROMPT = `Return a JSON code block with a "stores" array. If NO verifiable stores are found, return {"stores": []}.
Each object in "stores" must have:
- name: string (exact real business name as found in evidence)
- type: "Sovereign" or "Local Gem"
- address: string (real street address if known, OR a descriptive location like "Highway 97A near Enderby, BC" for informal/sovereign shops)
- province: A string matching one of: Alberta, British Columbia, Manitoba, New Brunswick, Newfoundland and Labrador, Nova Scotia, Northwest Territories, Nunavut, Ontario, Prince Edward Island, Quebec, Saskatchewan, Yukon
- website: string (real URL, social media page URL, or empty string if not found)
- sourceUrl: string (URL to evidence page - news articles, social media, forums, community posts all count)
- rating: number (real rating if found, 0 if unknown)
- featuredOfferings: string[] (only if verifiable)
- hours: array of {day: string, time: string} (only if verifiable, empty array otherwise)`;

const STORE_FIELDS_NO_PROVINCE_PROMPT = `Return a JSON code block with a "stores" array. If NO verifiable stores exist, return {"stores": []}.
Required fields per store:
- name: string (exact real business name)
- type: "Sovereign" or "Local Gem"
- address: string (real verified address, or descriptive location like "Highway 97A near Enderby, BC" for informal shops)
- featuredOfferings: string[] (only verifiable items)
- rating: number (real rating or 0)
- website: string (real URL, social media page URL, or empty string)
- sourceUrl: string (URL to evidence confirming this business - news articles, social media, forums all count)
- hours: array of {day: string, time: string} (verifiable hours or empty array)`;

const INDIGENOUS_HOTSPOTS: Record<string, string[]> = {
  "British Columbia": [
    "Splatsin First Nation, Enderby, Highway 97A corridor",
    "Six Nations territory near Kamloops area",
    "Tk'emlúps te Secwépemc, Kamloops",
    "Westbank First Nation, Kelowna area",
    "Musqueam, Squamish, Tsleil-Waututh, Vancouver area",
    "Songhees and Esquimalt Nations, Victoria area",
    "Cowichan Tribes, Duncan area",
    "Sto:lo Nation, Chilliwack/Fraser Valley",
    "Lytton First Nation area",
    "Adams Lake Band, Chase area",
  ],
  "Ontario": [
    "Six Nations of the Grand River, Ohsweken/Caledonia/Hagersville",
    "Tyendinaga Mohawk Territory, Highway 49/401 corridor near Belleville/Deseronto",
    "Alderville First Nation, Roseneath area",
    "Wahta Mohawk Territory, Bala/Muskoka area",
    "Curve Lake First Nation, Peterborough area",
    "Rama First Nation, Orillia area",
    "Oneida Nation of the Thames, London area",
    "Akwesasne, Cornwall/international border area",
    "Nipissing First Nation, North Bay area",
    "Wikwemikong, Manitoulin Island",
    "Garden River First Nation, Sault Ste. Marie area",
    "Fort William First Nation, Thunder Bay area",
    "Kettle and Stony Point First Nation, Ipperwash/Forest area",
  ],
  "Quebec": [
    "Kahnawake Mohawk Territory, south shore Montreal",
    "Kanesatake, Oka area",
    "Akwesasne (Quebec side), near Cornwall",
    "Wendake, Quebec City area",
    "Listuguj Mi'gmaq, Restigouche area",
    "Kitigan Zibi, Maniwaki area",
  ],
  "Alberta": [
    "Siksika Nation, east of Calgary",
    "Enoch Cree Nation, west Edmonton",
    "Stoney Nakoda, Morley area near Canmore",
    "Tsuut'ina Nation, southwest Calgary",
    "Samson Cree Nation, Hobbema/Maskwacis",
  ],
  "Manitoba": [
    "Long Plain First Nation, Portage la Prairie area",
    "Peguis First Nation",
    "Sagkeeng First Nation, Pine Falls area",
    "Brokenhead Ojibway Nation, Scanterbury area",
    "Roseau River, near Dominion City",
  ],
  "Saskatchewan": [
    "Whitecap Dakota First Nation, near Saskatoon",
    "Muskoday First Nation, near Prince Albert",
    "Beardy's and Okemasis Cree Nation",
    "Nekaneet First Nation, Maple Creek area",
  ],
  "New Brunswick": [
    "Elsipogtog First Nation, Richibucto area",
    "Tobique First Nation, Perth-Andover area",
    "Esgenoôpetitj (Burnt Church), Miramichi area",
  ],
  "Nova Scotia": [
    "Millbrook First Nation, Truro area",
    "Membertou First Nation, Sydney area",
    "Sipekne'katik, Indian Brook area",
  ],
};

export const getIndigenousHotspots = (province: Province): string[] => {
  return INDIGENOUS_HOTSPOTS[province] || [];
};

export const searchStores = async (query: string, userLocation?: { lat: number; lng: number }): Promise<{ 
  stores: Partial<Store>[];
}> => {
  try {
    const latLngConfig = userLocation ? { latitude: userLocation.lat, longitude: userLocation.lng } : undefined;

    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${ANTI_HALLUCINATION_PROMPT}

Find ALL sovereign Indigenous cannabis shops, trading posts, smoke shops, and independent dispensaries near: "${query}".

STRICT REQUIREMENT: EXCLUDE all government-licensed corporate dispensaries (e.g., OCS-authorized, BCCS, SQDC corporate stores, Tokyo Smoke, Tweed, etc.).

FOCUS ONLY ON:
1. Sovereign Indigenous dispensaries, trading posts, and smoke shops (often on First Nations land or reserves). These may be unlicensed and operate under Indigenous sovereignty.
2. Independent "Local Gems" that operate outside the standard corporate retail model.
3. Unlicensed trading posts and informal dispensaries known in local communities.

SEARCH STRATEGY - DO ALL OF THESE:
- Search Google Maps for cannabis/dispensary/smoke shop businesses in this area
- Search Google for news articles about unlicensed/sovereign cannabis shops in this area
- Search for Reddit threads, blog posts, or forum discussions mentioning shops in this location
- Search for any First Nations reserves or territories near this location and look for sovereign shops on them
- If this is near a highway corridor, search for ALL shops along that road, not just the closest one
- Look for shops known by informal names ("the shack", "the shed", etc.)
- Multiple sovereign shops often cluster together on the same reserve or highway - find ALL of them

${STORE_FIELDS_PROMPT}`,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: {
          retrievalConfig: { latLng: latLngConfig }
        }
      }
    });

    const data = extractJson(response.text || "");
    const pass1Stores: Partial<Store>[] = (data?.stores || []).filter((s: any) =>
      s.name && s.name.trim() !== '' &&
      s.address && s.address.trim() !== ''
    );

    if (pass1Stores.length > 0) {
      const foundNames = pass1Stores.map(s => s.name).filter(Boolean);
      try {
        const pass2Response = await getAI().models.generateContent({
          model: "gemini-2.5-flash",
          contents: `${ANTI_HALLUCINATION_PROMPT}

I searched for sovereign/independent cannabis shops near "${query}" and found these: ${foundNames.join(', ')}.

There are likely MORE shops in this area that I missed. Search specifically for:
1. Other sovereign cannabis shops, trading posts, or smoke shops on the same reserve or nearby reserves
2. Shops along the same highway or road corridor
3. Any other unlicensed or independent cannabis retailers in the immediate area
4. Shops mentioned alongside the ones above in news articles, Reddit threads, or social media

DO NOT include these stores I already found: ${foundNames.join(', ')}. Only return NEW, ADDITIONAL stores.

Search news articles, Reddit, social media, Google Maps, and community forums for any additional shops.

${STORE_FIELDS_PROMPT}`,
          config: {
            tools: [{ googleMaps: {} }, { googleSearch: {} }],
            toolConfig: {
              retrievalConfig: { latLng: latLngConfig }
            }
          }
        });

        const pass2Data = extractJson(pass2Response.text || "");
        const pass2Stores: Partial<Store>[] = (pass2Data?.stores || []).filter((s: any) =>
          s.name && s.name.trim() !== '' &&
          s.address && s.address.trim() !== '' &&
          !foundNames.some(n => n?.toLowerCase() === s.name?.toLowerCase())
        );

        return { stores: [...pass1Stores, ...pass2Stores] };
      } catch (pass2Error) {
        console.error("Pass 2 search error (non-fatal):", pass2Error);
        return { stores: pass1Stores };
      }
    }

    return { stores: pass1Stores };
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
IMPORTANT: Search for ALL shops in this area, not just the most well-known ones. Multiple sovereign shops often cluster along the same highway or reserve. Look for every one you can find evidence for.

${STORE_FIELDS_NO_PROVINCE_PROMPT}

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

export const deepDiveArea = async (areaDescription: string, province: Province, existingNames: string[]): Promise<Partial<Store>[]> => {
  const excludeList = existingNames.length > 0 
    ? `\nIMPORTANT: I already know about these stores, so DO NOT include them again: ${existingNames.join(', ')}. Only return NEW stores not in this list.`
    : '';

  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${ANTI_HALLUCINATION_PROMPT}

I need a THOROUGH search for sovereign Indigenous cannabis shops, trading posts, smoke shops, and dispensaries in this specific area:
"${areaDescription}" in ${province}, Canada.
${excludeList}

This is a DEEP DIVE search. Look beyond the obvious results:
- Search for news articles about unlicensed cannabis shops in this area
- Look for social media posts mentioning smoke shops or trading posts on this reserve/territory
- Check Reddit threads about cannabis shopping in this region
- Search for any blog posts or forum discussions mentioning specific shop names
- Look for Google Maps reviews or listings even if shops are informal
- Check local news coverage about sovereign cannabis retail in this community
- Look for shops described by landmarks ("the shack on the highway", "the shed near the gas station") 
- Multiple shops often operate along the same highway corridor - search for EACH ONE individually

MANDATORY: EXCLUDE all provincially licensed/regulated corporate stores.

${STORE_FIELDS_PROMPT}

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
    s.address && s.address.trim() !== '' &&
    !existingNames.some(n => n.toLowerCase() === (s.name || '').toLowerCase())
  );
};

export const neighborhoodExpand = async (foundStoreNames: string[], area: string, province: Province): Promise<Partial<Store>[]> => {
  if (foundStoreNames.length === 0) return [];

  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${ANTI_HALLUCINATION_PROMPT}

I found these sovereign/independent cannabis shops in ${area}, ${province}: ${foundStoreNames.join(', ')}.

There are likely MORE shops nearby that I missed. Search specifically for:
1. Other sovereign cannabis shops, trading posts, or smoke shops on the same reserve or nearby reserves
2. Shops along the same highway or road corridor
3. Any other unlicensed or independent cannabis retailers in the immediate area
4. Shops that may be mentioned alongside the ones I already found in news articles or social media

Do NOT include these stores I already know about: ${foundStoreNames.join(', ')}

Search news articles, Reddit, social media, and Google Maps for any additional shops I may have missed.

${STORE_FIELDS_PROMPT}

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
    s.address && s.address.trim() !== '' &&
    !foundStoreNames.some(n => n.toLowerCase() === (s.name || '').toLowerCase())
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
