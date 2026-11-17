import { ROOM_NAME } from '../shared/constants';

export { GameRoom } from './game-room';

function roomStub(env: Env) {
  // The hint only applies when the object is first created; "apac" keeps latency low for India.
  return env.GAME.get(env.GAME.idFromName(ROOM_NAME), { locationHint: 'apac' });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected a WebSocket upgrade', { status: 426 });
      }
      return roomStub(env).fetch(request);
    }
    if (url.pathname === '/api/media' && request.method === 'POST') {
      return roomStub(env).fetch(request);
    }
    if (url.pathname.startsWith('/api/media/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const cacheKey = new Request(url.toString(), { method: 'GET' });
      try {
        const hit = await caches.default.match(cacheKey);
        if (hit) return request.method === 'HEAD' ? new Response(null, { status: hit.status, headers: hit.headers }) : hit;
      } catch {
        // Cache API unavailable in some local setups; fall through to the Durable Object.
      }
      const res = await roomStub(env).fetch(request);
      if (res.ok && request.method === 'GET') {
        try {
          ctx.waitUntil(caches.default.put(cacheKey, res.clone()).catch(() => undefined));
        } catch {
          // ignore
        }
      }
      return res;
    }
    if (url.pathname === '/api/branding' && request.method === 'GET') {
      return roomStub(env).fetch(request);
    }
    if (url.pathname === '/api/health') return Response.json({ ok: true });
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
