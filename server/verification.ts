import type { Store, EvidenceSource } from '../types';

interface PlacesResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
}

async function searchPlacesNew(
  query: string,
  apiKey: string
): Promise<PlacesResult | null> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
    },
    body: JSON.stringify({ textQuery: query }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`New API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (!data.places || data.places.length === 0) return null;

  const place = data.places[0];
  return {
    placeId: place.id,
    name: place.displayName?.text || '',
    address: place.formattedAddress || '',
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    types: place.types || [],
  };
}

async function searchPlacesLegacy(
  query: string,
  apiKey: string
): Promise<PlacesResult | null> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Legacy API ${response.status}`);

  const data = await response.json();
  if (data.status === 'REQUEST_DENIED') throw new Error(`Legacy API denied: ${data.error_message}`);
  if (data.status !== 'OK' || !data.results || data.results.length === 0) return null;

  const place = data.results[0];
  return {
    placeId: place.place_id,
    name: place.name,
    address: place.formatted_address,
    lat: place.geometry?.location?.lat,
    lng: place.geometry?.location?.lng,
    types: place.types || [],
  };
}

async function searchGooglePlaces(
  query: string,
  apiKey: string
): Promise<PlacesResult | null> {
  try {
    return await searchPlacesNew(query, apiKey);
  } catch (newErr) {
    console.log(`[Verification] New Places API failed (${(newErr as Error).message}), trying legacy...`);
    try {
      return await searchPlacesLegacy(query, apiKey);
    } catch (legacyErr) {
      console.error(`[Verification] Both Places APIs failed. New: ${(newErr as Error).message}, Legacy: ${(legacyErr as Error).message}`);
      return null;
    }
  }
}

function extractCity(address: string): string {
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return parts[0] || '';
}

function nameMatchScore(storeName: string, placeName: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = normalize(storeName);
  const b = normalize(placeName);

  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.8;

  const aWords = storeName.toLowerCase().split(/\s+/);
  const bWords = placeName.toLowerCase().split(/\s+/);
  const common = aWords.filter((w) => bWords.includes(w));
  const score = (common.length * 2) / (aWords.length + bWords.length);
  return score;
}

export interface VerificationResult {
  verificationStatus: 'verified' | 'ai_suggested';
  confidenceScore: number;
  evidenceSources: EvidenceSource[];
  evidenceCount: number;
  placesApiMatch: boolean;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
  placesCategory?: string;
  lastVerifiedAt: string;
}

function getVerificationThreshold(storeType?: string): number {
  if (storeType === 'Sovereign') return 0.3;
  return 0.6;
}

export async function verifyStore(store: Partial<Store>): Promise<VerificationResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const evidenceSources: EvidenceSource[] = [];
  let confidenceScore = 0;
  let placesApiMatch = false;
  let googlePlaceId: string | undefined;
  let lat: number | undefined;
  let lng: number | undefined;
  let placesCategory: string | undefined;
  const isSovereign = store.type === 'Sovereign';

  if (apiKey && store.name && store.address) {
    const city = extractCity(store.address);
    const query = `${store.name} ${city} Canada`;
    console.log(`[Verification] Searching Places API for: "${query}"`);

    const result = await searchGooglePlaces(query, apiKey);

    if (result) {
      const matchScore = nameMatchScore(store.name, result.name);
      console.log(`[Verification] Places match: "${result.name}" (score: ${matchScore.toFixed(2)})`);

      if (matchScore >= 0.5) {
        placesApiMatch = true;
        googlePlaceId = result.placeId;
        lat = result.lat;
        lng = result.lng;
        placesCategory = result.types.join(', ');
        confidenceScore += 0.4;

        evidenceSources.push({
          type: 'google_places',
          name: `Google Places: ${result.name}`,
          url: `https://www.google.com/maps/place/?q=place_id:${result.placeId}`,
          date: new Date().toISOString().split('T')[0],
        });
      }
    }
  } else if (!apiKey) {
    console.log('[Verification] No GOOGLE_PLACES_API_KEY set, skipping Places verification');
  }

  if (store.website) {
    confidenceScore += 0.2;
    evidenceSources.push({
      type: 'web_search',
      name: 'Business Website',
      url: store.website,
      date: new Date().toISOString().split('T')[0],
    });
  }

  if (store.sourceUrl) {
    confidenceScore += 0.2;
    evidenceSources.push({
      type: 'directory',
      name: 'Source Reference',
      url: store.sourceUrl,
      date: new Date().toISOString().split('T')[0],
    });
  }

  if (store.featuredOfferings && store.featuredOfferings.length > 0) {
    confidenceScore += 0.1;
  }

  if (store.hours && store.hours.length > 0) {
    confidenceScore += 0.1;
  }

  if (isSovereign && !placesApiMatch) {
    confidenceScore += 0.15;
    evidenceSources.push({
      type: 'community_report',
      name: 'Sovereign/Indigenous community presence',
      date: new Date().toISOString().split('T')[0],
    });
  }

  const threshold = getVerificationThreshold(store.type);
  let verificationStatus: 'verified' | 'ai_suggested';
  if (confidenceScore >= threshold) {
    verificationStatus = 'verified';
  } else {
    verificationStatus = 'ai_suggested';
  }

  console.log(`[Verification] ${store.name}: score=${confidenceScore.toFixed(2)}, threshold=${threshold}, status=${verificationStatus}, type=${store.type || 'unknown'}`);

  return {
    verificationStatus,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    evidenceSources,
    evidenceCount: evidenceSources.length,
    placesApiMatch,
    googlePlaceId,
    lat,
    lng,
    placesCategory,
    lastVerifiedAt: new Date().toISOString(),
  };
}

export async function verifyStores(stores: Partial<Store>[]): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  for (const store of stores) {
    const result = await verifyStore(store);
    results.push(result);
  }
  return results;
}
