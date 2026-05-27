const https = require('https');
const http = require('http');
const { URL } = require('url');

function fetchUrl(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(urlStr); } catch (e) { return reject(new Error('URL inválida')); }

    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
        ...headers,
      },
    };

    const req = lib.request(options, (res) => {
      // follow redirects
      if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
        return fetchUrl(res.headers.location, headers).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Falta el parámetro url' });

  try {
    const result = await fetchUrl(url);
    if (result.status < 200 || result.status >= 400) {
      return res.status(result.status).json({ error: `El sitio respondió con ${result.status}` });
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(result.body.toString('utf-8'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
