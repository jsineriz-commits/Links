const https = require('https');
const http = require('http');
const { URL } = require('url');

function fetchUrl(urlStr, redirectsLeft = 8) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));

    let parsed;
    try { parsed = new URL(urlStr); } catch (e) { return reject(new Error('URL inválida: ' + urlStr)); }

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
        'Cache-Control': 'no-cache',
      },
    };

    const req = lib.request(options, (res) => {
      // Follow HTTP redirects, resolving relative Location headers
      if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) {
          loc = new URL(loc, parsed.origin).href;
        }
        res.resume(); // drain the body so the socket is freed
        return fetchUrl(loc, redirectsLeft - 1).then(resolve).catch(reject);
      }

      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks),
        finalUrl: urlStr,
      }));
    });

    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// Extract a meta tag value using regex (fast, no DOM)
function rxMeta(html, prop) {
  const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  const m = html.match(r1) || html.match(r2);
  return m ? m[1].trim() : '';
}

function rxLink(html, rel) {
  const r = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["']`, 'i');
  const r2 = new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${rel}["']`, 'i');
  const m = html.match(r) || html.match(r2);
  return m ? m[1].trim() : '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Falta el parámetro url' });

  try {
    // Step 1: fetch the URL (following HTTP redirects)
    let result = await fetchUrl(url);
    if (result.status < 200 || result.status >= 400) {
      return res.status(result.status).json({ error: `El sitio respondió con ${result.status}` });
    }

    let html = result.body.toString('utf-8');
    let finalUrl = result.finalUrl;

    // Step 2: if the page has no og:title/og:image, look for a canonical URL and re-fetch
    const hasData = rxMeta(html, 'og:title') || rxMeta(html, 'og:image');
    if (!hasData) {
      const canonical = rxLink(html, 'canonical') || rxMeta(html, 'og:url');
      if (canonical && canonical !== url && canonical !== finalUrl) {
        try {
          const r2 = await fetchUrl(canonical);
          if (r2.status >= 200 && r2.status < 400) {
            html = r2.body.toString('utf-8');
            finalUrl = r2.finalUrl;
          }
        } catch (e) { /* ignore, keep original html */ }
      }
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Final-Url', finalUrl);
    res.status(200).send(html);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
