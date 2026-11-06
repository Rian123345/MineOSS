import { tr } from './i18n';
import { serverText, serverFields } from './serverText';
export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>, public details?: any) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
/** Wird bei 401-Antworten aufgerufen (Sitzung abgelaufen). */
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'MineOS', Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, tr("Keine Verbindung zum Server. Bitte überprüfe deine Internetverbindung.", "No connection to the server. Please check your internet connection."));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/')) onUnauthorized?.();
    const msg = res.status === 404 && url.startsWith('/api/') && data?.error === 'API-Endpunkt nicht gefunden.'
      ? tr("Der MineOS-Server ist veraltet. Bitte alle schwarzen MineOS-Fenster schließen und „MineOS starten“ erneut öffnen.", "The MineOS server is outdated. Please close all black MineOS windows and open “Start MineOS” again.")
      : data?.error || tr(`Fehler ${res.status}`, `Error ${res.status}`);
    throw new ApiError(res.status, serverText(msg), serverFields(data?.fields), data?.details);
  }
  return data as T;
}

export const get = <T = any>(url: string) => api<T>('GET', url);
export const post = <T = any>(url: string, body: unknown = {}) => api<T>('POST', url, body);
export const put = <T = any>(url: string, body: unknown) => api<T>('PUT', url, body);
export const patch = <T = any>(url: string, body: unknown) => api<T>('PATCH', url, body);
export const del = <T = any>(url: string) => api<T>('DELETE', url);
