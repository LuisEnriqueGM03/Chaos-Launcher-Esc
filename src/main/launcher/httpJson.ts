import axios from 'axios';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET de un JSON probando cada URL (espejos) y reintentando con espera creciente. Lanza el último error si todo falla. */
export async function getJsonWithRetry(urls: string[], attempts = 3): Promise<any> {
  let lastErr: any = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    for (const url of urls) {
      try {
        const res = await axios.get(url, { timeout: 15000, headers: { 'Cache-Control': 'no-cache' } });
        if (res.data && typeof res.data === 'object') return res.data;
      } catch (err) {
        lastErr = err;
      }
    }
    if (attempt < attempts) await sleep(1000 * attempt);
  }
  throw lastErr || new Error('Respuesta vacía del servidor.');
}
