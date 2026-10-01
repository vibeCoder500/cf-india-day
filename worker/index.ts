import { ROOM_NAME } from '../shared/constants';

export { GameRoom } from './game-room';

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected a WebSocket upgrade', { status: 426 });
      }
      // The hint only applies when the object is first created; "apac" keeps latency low for India.
      const stub = env.GAME.get(env.GAME.idFromName(ROOM_NAME), { locationHint: 'apac' });
      return stub.fetch(request);
    }
    if (url.pathname === '/api/health') return Response.json({ ok: true });
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
