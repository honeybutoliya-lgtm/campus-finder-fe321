import test from 'node:test';
import assert from 'node:assert/strict';
import { seedVenues } from './data.js';
import { positionAlongRoute, routeDirections, searchPlaces, shortestRoute } from './routing.js';

test('all seeded venue places are connected to the public entrance', () => {
  for (const venue of seedVenues) {
    for (const place of venue.places) {
      const route = shortestRoute(venue, venue.startNodeId, place.nodeId);
      assert.ok(route, `${venue.name}: ${place.name} should be reachable`);
      assert.ok(route.distance >= 0);
      assert.ok(route.minutes >= 1);
    }
  }
});

test('step-free routes use the lift instead of stairs between floors', () => {
  const venue = seedVenues.find((item) => item.id === 'green-valley-school');
  const destination = venue.places.find((place) => place.name === 'Science Lab');
  const route = shortestRoute(venue, venue.startNodeId, destination.nodeId, { stepFree: true });
  assert.ok(route);
  assert.ok(route.edges.some((edge) => edge.mode === 'lift'));
  assert.ok(route.edges.every((edge) => edge.mode !== 'stairs'));
  assert.deepEqual(route.floors, ['ground', 'first']);
});

test('route directions include a floor change instruction', () => {
  const venue = seedVenues[0];
  const destination = venue.places.find((place) => place.floorId === 'first');
  const route = shortestRoute(venue, venue.startNodeId, destination.nodeId, { stepFree: true });
  const steps = routeDirections(route, destination);
  assert.ok(steps.some((step) => step.text.toLowerCase().includes('lift')));
  assert.match(steps.at(-1).text, new RegExp(destination.name));
  assert.ok(steps.every((step, index) => index === 0 || step.distanceMeters >= steps[index - 1].distanceMeters));
});

test('live map position interpolates along the selected path', () => {
  const venue = seedVenues[0];
  const destination = venue.places.find((place) => place.name === 'Shoe Store');
  const route = shortestRoute(venue, venue.startNodeId, destination.nodeId);
  const position = positionAlongRoute(route, route.progressAtNodes[1] / 2);
  assert.equal(position.floorId, 'ground');
  assert.equal(position.segmentIndex, 0);
  assert.ok(Math.abs(position.x - (route.nodes[0].x + route.nodes[1].x) / 2) < 0.001);
  assert.ok(Math.abs(position.y - (route.nodes[0].y + route.nodes[1].y) / 2) < 0.001);
});

test('live map position switches floors at the midpoint of a lift ride', () => {
  const venue = seedVenues.find((item) => item.id === 'green-valley-school');
  const destination = venue.places.find((place) => place.name === 'Science Lab');
  const route = shortestRoute(venue, venue.startNodeId, destination.nodeId, { stepFree: true });
  const liftEdgeIndex = route.edges.findIndex((edge) => edge.mode === 'lift');
  const start = route.progressAtNodes[liftEdgeIndex];
  const end = route.progressAtNodes[liftEdgeIndex + 1];
  const position = positionAlongRoute(route, (start + end) / 2);
  assert.equal(position.floorId, 'first');
  assert.equal(position.x, 710);
  assert.equal(position.y, 435);
});

test('router reports unreachable destinations when a floor connector is removed', () => {
  const venue = structuredClone(seedVenues[0]);
  const destination = venue.places.find((place) => place.floorId === 'first');
  venue.edges = venue.edges.filter((edge) => edge.mode !== 'lift' && edge.mode !== 'stairs');
  assert.equal(shortestRoute(venue, venue.startNodeId, destination.nodeId), null);
});

test('destination search tolerates a small typo', () => {
  const venue = seedVenues.find((item) => item.id === 'green-valley-school');
  const result = searchPlaces(venue.places, 'cantten');
  assert.equal(result[0]?.name, 'Canteen');
});
