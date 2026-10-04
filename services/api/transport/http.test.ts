import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createTransportServer } from './http.ts';

test('standalone transport service exposes honest plan and departure contracts', async () => {
  const server = createTransportServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    const departures = await fetch(
      `${base}/v1/transport/departures?stopId=orchard&mode=train&at=2026-10-04T10%3A07%3A00%2B08%3A00`,
    );
    assert.equal(departures.status, 200);
    const departureBody = await departures.json();
    assert.equal(departureBody.departures[0].status, 'scheduled');
    assert.equal(departureBody.service.everyMinutes, 5);
    const plan = await fetch(`${base}/v1/transport/plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        origin: 'orchard',
        destination: 'city-hall',
        departAt: '2026-10-04T10:07:00+08:00',
        modes: ['train', 'car'],
      }),
    });
    assert.equal(plan.status, 200);
    const body = await plan.json();
    assert.equal(body.awardEligible, false);
    assert.ok(
      body.routes.some((route: { mode: string }) => route.mode === 'train'),
    );
    assert.ok(
      body.unavailable.some(
        (item: { mode: string; reason: string }) =>
          item.mode === 'car' && item.reason === 'road_router_not_configured',
      ),
    );
    assert.equal(
      (
        await fetch(`${base}/v1/transport/plan`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(
          `${base}/v1/transport/departures?stopId=unknown&mode=train&at=2026-10-04T10%3A07%3A00%2B08%3A00`,
        )
      ).status,
      400,
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
});
