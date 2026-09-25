// Synthetic HTTP-only scanner fixture. Never a product endpoint.
import { createServer } from 'node:http';

createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (process.env.FIXTURE_UNSAFE !== '1') {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'");
    response.setHeader('Referrer-Policy', 'no-referrer');
  }
  if (request.url === '/robots.txt' || request.url === '/sitemap.xml') {
    response.writeHead(404);
  }
  response.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>Scanner fixture</title><p>Synthetic data only.</p></html>');
}).listen(3000, '0.0.0.0');
