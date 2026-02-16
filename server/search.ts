import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
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
    console.error("[Search] JSON Extraction Error:", e);
    console.error("[Search] Raw text:", text?.substring(0, 500));
    return null;
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

export async function serverSearchStores(query: string, userLocation?: { lat: number; lng: number }) {
  const latLngConfig = userLocation ? { latitude: userLocation.lat, longitude: userLocation.lng } : undefined;

  console.log(`[Search] Pass 1: Searching for "${query}"...`);

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
      tools: [{ googleSearch: {} }],
      toolConfig: {
        retrievalConfig: { latLng: latLngConfig }
      }
    }
  });

  console.log(`[Search] Pass 1 raw response length: ${response.text?.length || 0}`);

  const data = extractJson(response.text || "");
  const pass1Stores = (data?.stores || []).filter((s: any) =>
    s.name && s.name.trim() !== '' &&
    s.address && s.address.trim() !== ''
  );

  console.log(`[Search] Pass 1 found ${pass1Stores.length} stores: ${pass1Stores.map((s: any) => s.name).join(', ')}`);

  if (pass1Stores.length > 0) {
    const foundNames = pass1Stores.map((s: any) => s.name).filter(Boolean);
    try {
      console.log(`[Search] Pass 2: Looking for more stores near ${foundNames.join(', ')}...`);

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
          tools: [{ googleSearch: {} }],
          toolConfig: {
            retrievalConfig: { latLng: latLngConfig }
          }
        }
      });

      console.log(`[Search] Pass 2 raw response length: ${pass2Response.text?.length || 0}`);

      const pass2Data = extractJson(pass2Response.text || "");
      const pass2Stores = (pass2Data?.stores || []).filter((s: any) =>
        s.name && s.name.trim() !== '' &&
        s.address && s.address.trim() !== '' &&
        !foundNames.some((n: string) => n?.toLowerCase() === s.name?.toLowerCase())
      );

      console.log(`[Search] Pass 2 found ${pass2Stores.length} additional stores: ${pass2Stores.map((s: any) => s.name).join(', ')}`);
      return { stores: [...pass1Stores, ...pass2Stores] };
    } catch (pass2Error) {
      console.error("[Search] Pass 2 error (non-fatal):", pass2Error);
      return { stores: pass1Stores };
    }
  }

  return { stores: pass1Stores };
}
