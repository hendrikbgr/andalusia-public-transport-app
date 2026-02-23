import { getCookie, setCookie } from './cookies';

export interface SavedStop {
  idConsorcio: string;
  idParada: string;
  nombre: string;
  nucleo?: string;
  municipio?: string;
}

export function getSavedStops(): SavedStop[] {
  try {
    return JSON.parse(getCookie('savedStops') || '[]');
  } catch {
    return [];
  }
}

export function isStopSaved(idConsorcio: string, idParada: string): boolean {
  return getSavedStops().some(
    s => String(s.idConsorcio) === String(idConsorcio) && String(s.idParada) === String(idParada),
  );
}

export function addSavedStop(stop: SavedStop): void {
  const stops = getSavedStops();
  if (!isStopSaved(stop.idConsorcio, stop.idParada)) {
    stops.push(stop);
    setCookie('savedStops', JSON.stringify(stops), 365);
  }
}

export function removeSavedStop(idConsorcio: string, idParada: string): void {
  const stops = getSavedStops().filter(
    s => !(String(s.idConsorcio) === String(idConsorcio) && String(s.idParada) === String(idParada)),
  );
  setCookie('savedStops', JSON.stringify(stops), 365);
}
