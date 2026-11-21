const METERS_PER_MAP_UNIT = 0.22;

export function shortestRoute(venue, startNodeId, destinationNodeId, { stepFree = false } = {}) {
  const nodes = new Map(venue.nodes.map((node) => [node.id, node]));
  if (!nodes.has(startNodeId) || !nodes.has(destinationNodeId)) return null;
  const distances = new Map([[startNodeId, 0]]);
  const previous = new Map();
  const unvisited = new Set(nodes.keys());

  while (unvisited.size) {
    let current = null;
    let best = Infinity;
    for (const id of unvisited) {
      const distance = distances.get(id) ?? Infinity;
      if (distance < best) { best = distance; current = id; }
    }
    if (!current || best === Infinity) break;
    if (current === destinationNodeId) break;
    unvisited.delete(current);

    for (const edge of venue.edges) {
      if (stepFree && edge.mode === 'stairs') continue;
      const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (!next || !unvisited.has(next)) continue;
      const a = nodes.get(current);
      const b = nodes.get(next);
      const cost = edge.weight ?? Math.hypot(a.x - b.x, a.y - b.y) * METERS_PER_MAP_UNIT;
      const candidate = best + cost;
      if (candidate < (distances.get(next) ?? Infinity)) {
        distances.set(next, candidate);
        previous.set(next, { id: current, edge });
      }
    }
  }

  if (!distances.has(destinationNodeId)) return null;
  const path = [];
  const routeEdges = [];
  let cursor = destinationNodeId;
  path.unshift(nodes.get(cursor));
  while (cursor !== startNodeId) {
    const step = previous.get(cursor);
    if (!step) return null;
    routeEdges.unshift(step.edge);
    cursor = step.id;
    path.unshift(nodes.get(cursor));
  }
  const distance = Math.round(distances.get(destinationNodeId));
  const floorChanges = path.reduce((count, item, index) => count + (index > 0 && item.floorId !== path[index - 1].floorId ? 1 : 0), 0);
  const progressAtNodes = [0];
  for (let index = 1; index < path.length; index += 1) {
    const edge = routeEdges[index - 1];
    const previousNode = path[index - 1];
    const currentNode = path[index];
    progressAtNodes.push(progressAtNodes.at(-1) + (edge.weight ?? Math.hypot(currentNode.x - previousNode.x, currentNode.y - previousNode.y) * METERS_PER_MAP_UNIT));
  }
  return {
    nodes: path,
    edges: routeEdges,
    distance,
    distanceMeters: distances.get(destinationNodeId),
    progressAtNodes,
    minutes: Math.max(1, Math.ceil(distance / 80 + floorChanges)),
    floors: [...new Set(path.map((item) => item.floorId))],
  };
}

export function positionAlongRoute(route, distanceMeters = 0) {
  if (!route?.nodes?.length) return null;
  if (route.nodes.length === 1) return { ...route.nodes[0], segmentIndex: 0, routeAngle: -90 };

  const progress = route.progressAtNodes ?? [0, route.distanceMeters ?? route.distance];
  const distance = Math.max(0, Math.min(distanceMeters, route.distanceMeters ?? route.distance));
  let segmentIndex = progress.findIndex((start, index) => index < progress.length - 1 && distance >= start && distance <= progress[index + 1]);
  if (segmentIndex < 0) segmentIndex = route.nodes.length - 2;

  const from = route.nodes[segmentIndex];
  const to = route.nodes[segmentIndex + 1];
  const segmentLength = progress[segmentIndex + 1] - progress[segmentIndex];
  const fraction = segmentLength > 0 ? Math.max(0, Math.min(1, (distance - progress[segmentIndex]) / segmentLength)) : 1;
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    floorId: fraction < 0.5 ? from.floorId : to.floorId,
    segmentIndex,
    routeAngle: Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI,
  };
}

export function routeDirections(route, destination, venue, language = 'en') {
  if (!route?.nodes?.length) return [];
  const hindi = language === 'hi';
  const steps = [{ text: hindi ? `${route.nodes[0].label} से शुरू करें और गलियारे से आगे बढ़ें।` : `Start at ${route.nodes[0].label} and follow the corridor.`, floorId: route.nodes[0].floorId, icon: 'start', routeIndex: 0, distanceMeters: 0 }];
  for (let index = 1; index < route.nodes.length - 1; index += 1) {
    const previous = route.nodes[index - 1];
    const current = route.nodes[index];
    const next = route.nodes[index + 1];
    if (previous.floorId !== current.floorId) {
      const edge = route.edges[index - 1];
      const connector = edge?.mode === 'stairs' ? 'stairs' : 'lift';
      const floorName = venue?.floors.find((floor) => floor.id === current.floorId)?.name ?? (current.floorId === 'ground' ? 'Ground' : 'First');
      const text = hindi
        ? `${floorName} मंज़िल पर जाने के लिए ${connector === 'stairs' ? 'सीढ़ियों' : 'लिफ्ट'} लें।`
        : `Take the ${connector} to the ${floorName.toLowerCase()} floor.`;
      steps.push({ text, floorId: current.floorId, icon: connector, routeIndex: index, distanceMeters: route.progressAtNodes?.[index] ?? 0 });
      continue;
    }
    if (current.floorId !== next.floorId) continue;
    const first = { x: current.x - previous.x, y: current.y - previous.y };
    const second = { x: next.x - current.x, y: next.y - current.y };
    const cross = first.x * second.y - first.y * second.x;
    const dot = first.x * second.x + first.y * second.y;
    const angle = Math.atan2(-cross, dot) * 180 / Math.PI;
    if (Math.abs(angle) > 35) {
      const turn = angle > 0 ? 'left' : 'right';
      const text = hindi
        ? `${current.label} पर ${turn === 'left' ? 'बाएँ' : 'दाएँ'} मुड़ें और ${next.label} की ओर जाएँ।`
        : `At ${current.label}, turn ${turn} toward ${next.label}.`;
      steps.push({ text, floorId: current.floorId, icon: turn, routeIndex: index, distanceMeters: route.progressAtNodes?.[index] ?? 0 });
    }
  }
  const last = route.nodes.at(-1);
  steps.push({ text: hindi ? `आप ${destination.name} पर पहुँच गए हैं।` : `You have arrived at ${destination.name}.`, floorId: last.floorId, icon: 'finish', routeIndex: route.nodes.length - 1, distanceMeters: route.distanceMeters ?? route.distance });
  return steps;
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

export function searchPlaces(places, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return places.map((place) => {
    const name = place.name.toLowerCase();
    const words = name.split(/\s+/);
    const score = name.includes(needle) ? 0 : words.some((word) => word.startsWith(needle)) ? 1 : Math.min(...words.map((word) => editDistance(needle, word)));
    return { place, score };
  }).filter(({ score }) => score <= Math.max(1, Math.floor(needle.length / 4)))
    .sort((a, b) => a.score - b.score || a.place.name.localeCompare(b.place.name))
    .map(({ place }) => place);
}
