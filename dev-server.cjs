// Simple local dev server: serves static files + /api/* functions
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css',   '.json': 'application/json',
  '.png': 'image/png',  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Route API requests to the handler modules
  if (pathname.startsWith('/api/')) {
    const name = pathname.replace('/api/', '').replace(/\.js$/, '');
    try {
      const handler = require(path.join(ROOT, 'api', name + '.js'));
      // Build a mock req/res compatible with Vercel handler signature
      const mockReq = Object.assign(req, {
        query: Object.fromEntries(url.searchParams.entries()),
        method: req.method,
      });
      await handler(mockReq, res);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Serve static files
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) filePath = path.join(ROOT, 'index.html'); // SPA fallback

  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'text/plain';
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  ✅ Dev server running at http://localhost:${PORT}\n`);
});
