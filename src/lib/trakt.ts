// Trakt integration – TYMCZASOWO WYŁĄCZONA.
// Funkcje poniżej są tylko zaślepkami, żeby build przechodził.
// Prawdziwa integracja zostanie dopisana później.

export function traktConfigured(): boolean {
  return false;
}

export type TraktSearchResult = any;

function disabled(name: string): never {
  throw new Error(`Integracja z Trakt jest obecnie wyłączona (wywołano: ${name})`);
}

export async function startDeviceCode(...args: any[]): Promise<any> {
  return disabled("startDeviceCode");
}

export async function pollDeviceToken(...args: any[]): Promise<any> {
  return disabled("pollDeviceToken");
}

export async function saveTraktTokens(...args: any[]): Promise<any> {
  return disabled("saveTraktTokens");
}

export async function getActiveTraktAccount(...args: any[]): Promise<any> {
  return null;
}

export async function refreshTraktTokenIfNeeded(...args: any[]): Promise<any> {
  return disabled("refreshTraktTokenIfNeeded");
}

export async function searchTrakt(...args: any[]): Promise<TraktSearchResult[]> {
  return [];
}

export async function ensureCustomList(...args: any[]): Promise<any> {
  return disabled("ensureCustomList");
}

export async function addItemsToList(...args: any[]): Promise<any> {
  return disabled("addItemsToList");
}

export function buildTraktItemPayload(...args: any[]): any {
  return disabled("buildTraktItemPayload");
}

export async function pushWatchlist(...args: any[]): Promise<any> {
  return disabled("pushWatchlist");
}

export async function pushHistory(...args: any[]): Promise<any> {
  return disabled("pushHistory");
}

export async function pushRatings(...args: any[]): Promise<any> {
  return disabled("pushRatings");
}

export async function postComment(...args: any[]): Promise<any> {
  return disabled("postComment");
}
