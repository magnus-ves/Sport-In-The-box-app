// Klient for Sport In The Box sitt REST V2-API. Stiene er som i SIB sin dokumentasjon.

export const SIBPath = {
  quickButtons: () => '/api/quickbutton/',
  quickTrigger: (triggerId: number) => `/api/quickbutton/trig/${triggerId}`,

  rundownsWithItems: () => '/api/rundown-with-items/',
  selection: () => '/api/rundown/selection',
  selectRundown: (rd: number) => `/api/rundown/select-rundown/${rd}`,
  itemRun: (rd: number, item: number) => `/api/rundown/item-run/${rd}/${item}`,
  selectedRun: (rd: number) => `/api/rundown/selected-run/${rd}`,
  previousRun: (rd: number) => `/api/rundown/item-previous-run/${rd}`,
  nextRun: (rd: number) => `/api/rundown/item-next-run/${rd}`,
  selectPrevious: () => '/api/rundown/select-previous',
  selectNext: () => '/api/rundown/select-next',

  playlist: (id: string) => `/api/playlist/${id}`,
  playFromStart: (id: string) => `/api/playlist/trig/from_start/${id}/`,
  playFromLast: (id: string) => `/api/playlist/trig/from_last/${id}/`,
  playFromItem: (id: string, item: number) => `/api/playlist/trig/from_item/${id}/item/${item}/`,

  streams: () => '/api/streams/',
  streamControl: (id: number, action: 'START' | 'STOP') => `/api/stream-control/${id}/${action}/`,
};

// ---------------------------------------------------------------------------
// Typer (SIB bruker PascalCase)
// ---------------------------------------------------------------------------

export type QuickButton = {
  QuickButtonOid?: number;
  TriggerId: number;
  ButtonText?: string;
  Icon?: string;
  BackgroundColor?: string;
  Shortcut?: string;
};

export type QuickButtonGroup = {
  QuickButtonGroupOid: number;
  ButtonText?: string;
  BackgroundColor?: string;
  Buttons?: QuickButton[];
};

export type RundownItem = {
  ParentId?: number;
  Id: number;
  Order?: number;
  Ident?: string;
  Clock?: string;
  Name?: string;
  Description?: string;
  ColorHex?: string;
  HasEvents?: boolean;
};

export type Rundown = {
  Id: number;
  Order?: number;
  Name?: string;
  ColorHex?: string;
  Items?: RundownItem[];
};

export type RundownSelection = {
  SelectedRundown?: number;
  SelectedItems?: Record<string, number>;
};

export type PlaylistFile = { MedialistItemOid: number; MedialistItemName?: string };

export type SIBStream = { Id: number; Name?: string; IsStreaming?: boolean };

// ---------------------------------------------------------------------------
// Feil
// ---------------------------------------------------------------------------

export type SIBErrorKind = 'badUrl' | 'unreachable' | 'unauthorized' | 'notFound' | 'http';

export class SIBError extends Error {
  constructor(public kind: SIBErrorKind, message: string, public status?: number) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Klient
// ---------------------------------------------------------------------------

export type Connection = { baseUrl: string; password: string };

/** Normaliserer "192.168.1.50" / "sib-pc.local:8080/" til "http://192.168.1.50:8080". Null hvis ugyldig. */
export function normalizeBaseUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  const m = s.match(/^(https?):\/\/([^/:?#\s]+)(?::(\d+))?/i);
  if (!m) return null;
  const [, scheme, host, port] = m;
  return `${scheme.toLowerCase()}://${host}:${port ?? '8080'}`;
}

/**
 * SIB tar passordet som siste del av stien:
 * /api/quickbutton/trig/8 -> /api/quickbutton/trig/8/passord
 * /api/streams/           -> /api/streams/passord/
 */
export function withPassword(path: string, password: string): string {
  if (!password) return path;
  const encoded = encodeURIComponent(password);
  return path.endsWith('/') ? `${path.slice(0, -1)}/${encoded}/` : `${path}/${encoded}`;
}

export async function sibRequest(
  conn: Connection,
  path: string,
  { method = 'GET', body, timeoutMs = 5000 }: { method?: string; body?: string; timeoutMs?: number } = {},
): Promise<string> {
  const base = normalizeBaseUrl(conn.baseUrl);
  if (!base) throw new SIBError('badUrl', 'Legg inn adressen til Sport In The Box under Innstillinger.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(base + withPassword(path, conn.password), {
      method,
      body,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      signal: controller.signal,
    });
  } catch {
    const reason = controller.signal.aborted ? 'tidsavbrudd' : 'ingen svar';
    throw new SIBError('unreachable', `Får ikke kontakt med Sport In The Box (${reason}).`);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text().catch(() => '');
  if (res.ok) return text;
  if (res.status === 401 || res.status === 403) {
    throw new SIBError('unauthorized', 'Ingen tilgang – sjekk API-passordet under Innstillinger.', res.status);
  }
  if (res.status === 404) throw new SIBError('notFound', 'Ikke funnet i Sport In The Box (404).', 404);
  throw new SIBError('http', `Feil fra Sport In The Box (${res.status}).`, res.status);
}

export async function sibGet<T>(conn: Connection, path: string): Promise<T> {
  const text = await sibRequest(conn, path);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SIBError('http', 'Uventet svar fra Sport In The Box.');
  }
}

// ---------------------------------------------------------------------------
// Hjelpere
// ---------------------------------------------------------------------------

/** SIB-farger er "#RRGGBB" eller "#RRGGBBAA". Helt transparente gir null. */
export function sibColor(hex?: string): string | null {
  if (!hex || !/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  if (hex.length === 9 && hex.slice(7).toLowerCase() === '00') return null;
  return hex;
}

export function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

/** Base64-bilde fra SIB -> data-URI. SVG støttes ikke av <Image>, så de hoppes over. */
export function base64Image(data?: string): string | null {
  if (!data || data.length < 16) return null;
  if (data.startsWith('data:')) return data;
  if (data.startsWith('PHN2') || data.startsWith('PD94')) return null;
  const mime = data.startsWith('/9j/') ? 'image/jpeg' : data.startsWith('R0lG') ? 'image/gif' : 'image/png';
  return `data:${mime};base64,${data}`;
}

/** "G,False,True,False" = tast, Alt, Ctrl, Shift -> "Ctrl+G" */
export function shortcutLabel(shortcut?: string): string | null {
  const parts = (shortcut ?? '').split(',');
  if (!parts[0]) return null;
  return [parts[2] === 'True' && 'Ctrl', parts[1] === 'True' && 'Alt', parts[3] === 'True' && 'Shift', parts[0]]
    .filter(Boolean)
    .join('+');
}

/** "2024-04-24T18:05:00" -> "18:05". Tom tid ("0001-01-01...") -> "". */
export function formatClock(iso?: string): string {
  if (!iso || iso.startsWith('0001-')) return '';
  const m = iso.match(/T(\d{2}:\d{2})(?::(\d{2}))?/);
  if (!m) return '';
  return m[2] && m[2] !== '00' ? `${m[1]}:${m[2]}` : m[1];
}
