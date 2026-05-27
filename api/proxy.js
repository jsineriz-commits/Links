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
      // Follow HTTP redirects
      if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) {
          loc = new URL(loc, parsed.origin).href;
        }
        res.resume();
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

// Check if the HTML has useful og:tags
function hasOgData(html) {
  return /<meta[^>]+property=["']og:title["'][^>]+content=["'][^"']{3,}/i.test(html) ||
         /<meta[^>]+content=["'][^"']{3,}["'][^>]+property=["']og:title["']/i.test(html);
}

// Extract JavaScript redirect URL: window.location.href = '...' or window.location = '...'
function extractJsRedirect(html, baseUrl) {
  const patterns = [
    /window\.location\.href\s*=\s*['"]([^'"]+)['"]/i,
    /window\.location\s*=\s*['"]([^'"]+)['"]/i,
    /location\.replace\s*\(\s*['"]([^'"]+)['"]\s*\)/i,
    /location\.href\s*=\s*['"]([^'"]+)['"]/i,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m && m[1]) {
      let url = m[1].trim();
      if (!url.startsWith('http')) {
        url = new URL(url, new URL(baseUrl).origin).href;
      }
      // Make sure it's the same domain
      if (url.includes('decampoacampo.com')) return url;
    }
  }
  return null;
}

// Extract canonical URL from <link rel="canonical"> or og:url
function extractCanonical(html, baseUrl) {
  const r1 = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i;
  const r2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i;
  const r3 = /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i;
  const r4 = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i;
  const m = html.match(r1) || html.match(r2) || html.match(r3) || html.match(r4);
  if (!m) return null;
  let url = m[1].trim();
  if (!url.startsWith('http')) url = new URL(url, new URL(baseUrl).origin).href;
  if (url.includes('decampoacampo.com') && url !== baseUrl) return url;
  return null;
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

    // Step 2: if no og:data, try JS redirect first, then canonical
    if (!hasOgData(html)) {
      const jsRedirect = extractJsRedirect(html, url);
      const canonical  = extractCanonical(html, url);
      const target = jsRedirect || canonical;

      if (target) {
        try {
          const r2 = await fetchUrl(target);
          if (r2.status >= 200 && r2.status < 400) {
            html     = r2.body.toString('utf-8');
            finalUrl = r2.finalUrl;
          }
        } catch (e) { /* keep original */ }
      }
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Final-Url', finalUrl);
    res.status(200).send(html);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
