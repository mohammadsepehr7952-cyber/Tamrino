// Cloudflare Worker: proxy for Supabase
// Paste this whole file into the Cloudflare Worker editor.
// It forwards every request to Supabase and relays the response back,
// so the browser only ever talks to db.tamrino44.ir (our own domain).

const SUPABASE_TARGET = 'https://akragiujygurdhyqwxof.supabase.co';

export default {
  async fetch(request) {
    // Handle the browser's CORS preflight request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = SUPABASE_TARGET + url.pathname + url.search;

    const headers = new Headers(request.headers);
    headers.delete('host');

    const init = {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
    };

    const response = await fetch(targetUrl, init);

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
