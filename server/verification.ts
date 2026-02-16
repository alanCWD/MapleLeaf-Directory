import type { Store, EvidenceSource } from '../types';

interface PlacesResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
}

async function searchGooglePlaces(
  query: string,
  apiKey: string
): Promise<PlacesResult | null> {
  try {
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
      console.error(`Google Places API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    if (!data.places || data.places.length === 0) {
      console.log('[Verification] No Places results found');
      return null;
    }

    const place = data.places[0];
    return {
      placeId: place.id,
      name: place.displayName?.text || '',
      address: place.formattedAddress || '',
      lat: place.location?.latitude,
      lng: place.location?.longitude,
      types: place.types || [],
    };
  } catch (error) {
    console.error('Google Places search error:', error);
    return null;
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

export async function verifyStore(store: Partial<Store>): Promise<VerificationResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const evidenceSources: EvidenceSource[] = [];
  let confidenceScore = 0;
  let placesApiMatch = false;
  let googlePlaceId: string | undefined;
  let lat: number | undefined;
  let lng: number | undefined;
  let placesCategory: string | undefined;

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

  let verificationStatus: 'verified' | 'ai_suggested';
  if (confidenceScore >= 0.6) {
    verificationStatus = 'verified';
  } else {
    verificationStatus = 'ai_suggested';
  }

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
