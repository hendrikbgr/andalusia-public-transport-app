import { API } from './constants';

// ---- Type definitions ----

export interface Consorcio {
  idConsorcio: string;
  nombre: string;
  nombreCorto: string;
}

export interface Parada {
  idParada: string;
  nombre: string;
  municipio?: string;
  nucleo?: string;
  idConsorcio?: string;
}

export interface Departure {
  linea: string;
  destino: string;
  tiempo: string;       // minutes as string, or "0" for now
  hora: string;         // scheduled time "HH:MM"
  idLinea?: string;
  idParada?: string;
  zona?: string;
  codigo?: string;
}

export interface ParadaDetail {
  parada: Parada;
  salidas?: Departure[];
}

export interface LineaParada {
  idParada: string;
  nombre: string;
  municipio?: string;
  nucleo?: string;
  orden?: number;
}

export interface Linea {
  idLinea: string;
  nombre: string;
  codigo: string;
  polilinea?: Array<{ lat: number; lon: number }>;
}

export interface Nucleo {
  idNucleo: string;
  nombre: string;
}

export interface HorarioTrip {
  idlinea: string;
  codigo: string;
  dias: string;
  horas: string[];
}

export interface HorarioBloque {
  nombre: string;
  tipo?: string;
  colspan?: number;
}

export interface HorarioNucleo {
  nombre: string;
  colspan?: number;
}

export interface Frecuencia {
  acronimo: string;
  nombre: string;
}

export interface HorariosResponse {
  horario: HorarioTrip[];
  bloques: HorarioBloque[];
  nucleos: HorarioNucleo[];
  frecuencias: Frecuencia[];
}

export interface Noticia {
  titulo: string;
  descripcion: string;
}

export interface GlobalFrecuencia {
  idFreq: string;
  nombre: string;
  acronimo: string;
}

export interface TimetablePlanif {
  bloquesIda?: HorarioBloque[];
  bloquesVuelta?: HorarioBloque[];
  horarioIda?: HorarioTrip[];
  horarioVuelta?: HorarioTrip[];
}

export interface TimetableResponse {
  planificadores: TimetablePlanif[];
  frecuencias?: Array<{ idfrecuencia: string; acronimo: string; nombre: string }>;
}

// ---- Fetch helper ----

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---- API functions ----

export async function getConsorcios(): Promise<Consorcio[]> {
  const data = await fetchJSON<{ consorcios: Consorcio[] }>(`${API}/consorcios`);
  return data.consorcios;
}

export async function getParadas(cId: string): Promise<Parada[]> {
  const data = await fetchJSON<{ paradas: Parada[] }>(`${API}/${cId}/paradas/`);
  return data.paradas || [];
}

export async function getParadaSalidas(cId: string, sId: string): Promise<ParadaDetail> {
  return fetchJSON<ParadaDetail>(`${API}/${cId}/paradas/${sId}`);
}

export async function getLinea(cId: string, lId: string): Promise<Linea> {
  return fetchJSON<Linea>(`${API}/${cId}/lineas/${lId}`);
}

export async function getLineaParadas(cId: string, lId: string): Promise<LineaParada[]> {
  const data = await fetchJSON<{ paradas: LineaParada[] }>(`${API}/${cId}/lineas/${lId}/paradas`);
  return data.paradas || [];
}

export async function getLineaNoticias(cId: string, lId: string): Promise<Noticia[]> {
  const data = await fetchJSON<{ noticias: Noticia[] }>(`${API}/${cId}/lineas/${lId}/noticias`);
  return data.noticias || [];
}

export async function getNucleos(cId: string): Promise<Nucleo[]> {
  const data = await fetchJSON<{ nucleos: Nucleo[] }>(`${API}/${cId}/nucleos`);
  return data.nucleos || [];
}

export async function getHorariosOrigenDestino(
  cId: string,
  fromId: string,
  toId: string,
): Promise<HorariosResponse> {
  return fetchJSON<HorariosResponse>(
    `${API}/${cId}/horarios_origen_destino?idNucleoOrigen=${fromId}&idNucleoDestino=${toId}`,
  );
}

export async function getLineas(cId: string): Promise<Linea[]> {
  const data = await fetchJSON<{ lineas: Linea[] }>(`${API}/${cId}/lineas`);
  return data.lineas || [];
}

export async function getGlobalFrecuencias(cId: string): Promise<GlobalFrecuencia[]> {
  const data = await fetchJSON<{ frecuencias: GlobalFrecuencia[] }>(`${API}/${cId}/frecuencias`);
  return data.frecuencias || [];
}

export async function getHorariosLineas(
  cId: string,
  lineId: string,
  freqId: string,
  dia: number,
  mes: number,
): Promise<TimetableResponse> {
  return fetchJSON<TimetableResponse>(
    `${API}/${cId}/horarios_lineas?idLinea=${lineId}&idFrecuencia=${freqId}&dia=${dia}&mes=${mes}`,
  );
}

export async function getNucleoLineas(cId: string, nucId: string): Promise<Linea[]> {
  const data = await fetchJSON<{ lineas: Linea[] }>(`${API}/${cId}/nucleos/${nucId}/lineas`);
  return data.lineas || [];
}
