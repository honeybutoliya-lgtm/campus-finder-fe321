import { useRef, useState } from 'react';
import { LocateFixed, Maximize2, Minus, Plus } from 'lucide-react';
import { findNode } from './data.js';

export default function IndoorMap({ venue, floorId, route, startNodeId, currentPosition, destination, category = 'all', blocked = [], onSelectPlace }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [followUser, setFollowUser] = useState(true);
  const drag = useRef(null);
  const placesOnFloor = venue.places.filter((place) => {
    if (place.floorId !== floorId) return false;
    const location = findNode(venue, place.nodeId);
    return category === 'all' || location?.type !== 'room' || place.category === category || place.id === destination?.id;
  });
  const start = findNode(venue, startNodeId);
  const destinationNode = destination ? findNode(venue, destination.nodeId) : null;
  const routeSegments = (route?.nodes ?? []).slice(1).flatMap((node, index) => {
    const previous = route.nodes[index];
    if (node.floorId !== floorId || previous.floorId !== floorId) return [];
    const startDistance = route.progressAtNodes?.[index] ?? 0;
    const endDistance = route.progressAtNodes?.[index + 1] ?? route.distanceMeters ?? route.distance;
    const progress = currentPosition?.progressMeters ?? 0;
    if (progress >= endDistance) return [];
    if (progress <= startDistance) return [{ points: `${previous.x},${previous.y} ${node.x},${node.y}`, completed: false }];
    const fraction = (progress - startDistance) / Math.max(0.001, endDistance - startDistance);
    const x = previous.x + (node.x - previous.x) * fraction;
    const y = previous.y + (node.y - previous.y) * fraction;
    return [{ points: `${x},${y} ${node.x},${node.y}`, completed: false }];
  });
  const completedSegments = (route?.nodes ?? []).slice(1).flatMap((node, index) => {
    const previous = route.nodes[index];
    if (node.floorId !== floorId || previous.floorId !== floorId) return [];
    const startDistance = route.progressAtNodes?.[index] ?? 0;
    const endDistance = route.progressAtNodes?.[index + 1] ?? route.distanceMeters ?? route.distance;
    const progress = currentPosition?.progressMeters ?? 0;
    if (progress <= startDistance) return [];
    if (progress >= endDistance) return [{ points: `${previous.x},${previous.y} ${node.x},${node.y}` }];
    const fraction = (progress - startDistance) / Math.max(0.001, endDistance - startDistance);
    const x = previous.x + (node.x - previous.x) * fraction;
    const y = previous.y + (node.y - previous.y) * fraction;
    return [{ points: `${previous.x},${previous.y} ${x},${y}` }];
  });
  const floorMarkers = route?.nodes.filter((node) => node.floorId === floorId) ?? [];
  const markerPosition = currentPosition ?? (start && floorMarkers.some((node) => node.id === startNodeId) ? { ...start, routeAngle: -90 } : null);

  function pointerDown(event) {
    if (event.button !== 0) return;
    const following = followUser && currentPosition?.floorId === floorId;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      panX: following ? (500 - currentPosition.x * zoom) - 500 * (1 - zoom) : pan.x,
      panY: following ? (280 - currentPosition.y * zoom) - 280 * (1 - zoom) : pan.y,
    };
    setFollowUser(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event) {
    if (!drag.current) return;
    setPan({ x: drag.current.panX + (event.clientX - drag.current.x) / 2, y: drag.current.panY + (event.clientY - drag.current.y) / 2 });
  }

  function pointerUp() { drag.current = null; }
  const translateX = followUser && currentPosition?.floorId === floorId ? 500 - currentPosition.x * zoom : pan.x + 500 * (1 - zoom);
  const translateY = followUser && currentPosition?.floorId === floorId ? 280 - currentPosition.y * zoom : pan.y + 280 * (1 - zoom);

  return (
    <div className="map-frame" aria-label={`${venue.name} ${venue.floors.find((floor) => floor.id === floorId)?.name} map`}>
      <div className="map-controls" aria-label="Map controls">
        <button className="icon-button map-control" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.5, value + 0.12))}><Plus size={17} /></button>
        <button className="icon-button map-control" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.88, value - 0.12))}><Minus size={17} /></button>
        {currentPosition && <button className={`icon-button map-control${followUser ? ' is-following' : ''}`} title="Follow my location" aria-label="Follow my location" onClick={() => setFollowUser(true)}><LocateFixed size={17} /></button>}
        <button className="icon-button map-control" title="Reset map view" aria-label="Reset map view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setFollowUser(true); }}><Maximize2 size={16} /></button>
      </div>
      <svg className="indoor-map" viewBox="0 0 1000 560" role="group" aria-label="Interactive indoor floor plan. Select a room to see its route.">
        <defs>
          <pattern id="map-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="var(--map-grid)" strokeWidth="1" /></pattern>
          <filter id="pin-shadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity=".18" /></filter>
        </defs>
        <g transform={`translate(${translateX} ${translateY}) scale(${zoom})`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
          <rect x="20" y="24" width="960" height="512" rx="20" className="map-building" />
          <rect x="20" y="24" width="960" height="512" rx="20" fill="url(#map-grid)" />
          <g className="map-corridors">
            <path d="M76 280H916M270 128V432M490 128V435M710 128V435M916 128V435M76 435H270" />
            <path d="M76 280H916" className="corridor-center" />
          </g>
          <text x="72" y="326" className="map-zone-label">{floorId === 'ground' ? 'ENTRANCE' : 'UPPER HALL'}</text>
          <text x="490" y="315" className="map-zone-label" textAnchor="middle">CENTRAL HALL</text>
          <text x="908" y="315" className="map-zone-label" textAnchor="end">EAST HALL</text>

          {placesOnFloor.map((place) => {
            const location = findNode(venue, place.nodeId);
            if (!location) return null;
            const isBlocked = blocked.includes(place.id);
            const isDestination = place.id === destination?.id;
            const isSelected = isDestination && route;
            const service = location.type !== 'room';
            if (service && location.id === startNodeId) return null;
            const width = 162;
            const height = 88;
            const lines = place.name.length > 19 ? [place.name.slice(0, 19), place.name.slice(19, 36)] : [place.name];
            const labelX = location.y > 400 ? location.x : location.x > 820 ? location.x - 18 : location.x + 18;
            const labelY = location.y > 400 ? location.y + 31 : location.y + 4;
            const labelAnchor = location.y > 400 ? 'middle' : location.x > 820 ? 'end' : 'start';
            return (
              <g key={place.id} role="button" tabIndex="0" aria-label={`${place.name}${isBlocked ? ', temporarily closed' : ''}`} className={`map-room${isSelected ? ' is-destination' : ''}${isBlocked ? ' is-blocked' : ''}${service ? ' is-service' : ''}`} onClick={() => onSelectPlace(place)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectPlace(place); } }}>
                {service ? <>
                  <circle cx={location.x} cy={location.y} r="12" className="service-marker" />
                  <text x={labelX} y={labelY} textAnchor={labelAnchor} className="service-label"><tspan className="desktop-map-label">{place.name}</tspan><tspan className="mobile-map-label">{place.mapLabel ?? place.name.slice(0, 9)}</tspan></text>
                  {isBlocked && <text x={labelX} y={labelY + 14} textAnchor={labelAnchor} className="closed-label">CLOSED</text>}
                </> : <>
                  <rect className="room-hit" x={location.x - width / 2} y={location.y - 66} width={width} height="132" rx="9" />
                  <rect x={location.x - width / 2} y={location.y - height / 2} width={width} height={height} rx="9" />
                  <circle cx={location.x - width / 2 + 18} cy={location.y - height / 2 + 18} r="5" className="room-dot" />
                  <text x={location.x} y={location.y + (lines.length > 1 ? -3 : 4)} textAnchor="middle" className="room-name">
                    {lines.map((line, index) => <tspan className="desktop-map-label" key={index} x={location.x} dy={index === 0 ? 0 : 13}>{line}</tspan>)}
                    <tspan className="mobile-map-label" x={location.x} dy="0">{place.mapLabel ?? place.name.slice(0, 9)}</tspan>
                  </text>
                  {isBlocked && <text x={location.x} y={location.y + 30} textAnchor="middle" className="closed-label">TEMPORARILY CLOSED</text>}
                </>}
              </g>
            );
          })}

          {routeSegments.map(({ points }, index) => <g key={`remaining-${index}`}><polyline points={points} className="route-casing" /><polyline points={points} className="route-line" /></g>)}
          {completedSegments.map(({ points }, index) => <g key={`completed-${index}`}><polyline points={points} className="route-casing" /><polyline points={points} className="route-completed" /></g>)}
          {markerPosition?.floorId === floorId && route && (
            <g className={`you-marker${currentPosition ? ' is-live' : ''}`} filter="url(#pin-shadow)"><circle cx={markerPosition.x} cy={markerPosition.y} r="18" /><circle cx={markerPosition.x} cy={markerPosition.y} r="7" /><path d={`M${markerPosition.x} ${markerPosition.y - 14} L${markerPosition.x - 6} ${markerPosition.y - 4} L${markerPosition.x} ${markerPosition.y - 6} L${markerPosition.x + 6} ${markerPosition.y - 4}Z`} transform={`rotate(${(markerPosition.routeAngle ?? -90) + 90} ${markerPosition.x} ${markerPosition.y})`} /><rect x={markerPosition.x - 24} y={markerPosition.y + 20} width="48" height="17" rx="8" /><text x={markerPosition.x} y={markerPosition.y + 32} textAnchor="middle">YOU</text></g>
          )}
          {destinationNode?.floorId === floorId && route && (
            <g className="destination-pin" filter="url(#pin-shadow)"><path d={`M${destinationNode.x} ${destinationNode.y + 3} C${destinationNode.x - 20} ${destinationNode.y - 21},${destinationNode.x - 16} ${destinationNode.y - 45},${destinationNode.x} ${destinationNode.y - 45} C${destinationNode.x + 17} ${destinationNode.y - 45},${destinationNode.x + 21} ${destinationNode.y - 21},${destinationNode.x} ${destinationNode.y + 3}Z`} /><circle cx={destinationNode.x} cy={destinationNode.y - 29} r="5" /><text x={destinationNode.x} y={destinationNode.y + 18} textAnchor="middle">{destination.name}</text></g>
          )}
          {floorId === 'ground' && start && start.floorId !== floorId && <text x="75" y="510" className="map-footnote">Starting point: {start.label}</text>}
        </g>
      </svg>
      <div className="map-legend"><span><i className="legend-dot legend-you" />You are here</span><span><i className="legend-dot legend-destination" />Destination</span><span><i className="legend-line" />Route</span></div>
    </div>
  );
}
