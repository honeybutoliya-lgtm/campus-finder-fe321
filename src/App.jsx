import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility, ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, AudioLines, Banknote, Bath, Bookmark,
  Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Coffee, Compass, DoorOpen, ExternalLink,
  Footprints, Heart, HelpCircle, Home, Info, Languages, Library, LifeBuoy, ListFilter, LocateFixed,
  LockKeyhole, Map, MapPin, Menu, Moon, Navigation, ParkingCircle, Pencil, Phone, Plus, QrCode, Search,
  Pause, Play, Send, Settings2, ShieldAlert, ShoppingBag, Sun, Trash2, Utensils, X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import IndoorMap from './IndoorMap.jsx';
import { categories, categoryLabel, findNode, seedVenues } from './data.js';
import { positionAlongRoute, routeDirections, searchPlaces, shortestRoute } from './routing.js';
import { translate } from './i18n.js';

const iconForCategory = {
  food: Coffee, restrooms: Bath, exits: DoorOpen, atm: Banknote, lifts: Accessibility,
  parking: ParkingCircle, help: HelpCircle, shops: ShoppingBag,
};
const readStore = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};
const writeStore = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing may disable storage */ } };

function Logo({ compact = false }) {
  return <div className={`brand${compact ? ' brand-compact' : ''}`}><img src="/wayin-mark.svg" alt="" /><span>WayIn</span></div>;
}

function IconButton({ label, children, onClick, className = '', ...props }) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick} {...props}>{children}</button>;
}

function EmptyState({ icon: Icon = MapPin, title, body, action, onAction }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={23} /></span><strong>{title}</strong><p>{body}</p>{action && <button className="button button-primary" onClick={onAction}>{action}</button>}</div>;
}

function Modal({ title, onClose, children, className = '' }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-heading"><h2>{title}</h2><IconButton label="Close" onClick={onClose}><X size={19} /></IconButton></div>
      {children}
    </section>
  </div>;
}

function VenueCard({ venue, onOpen, onDetails }) {
  return <article className="venue-card">
    <button className="venue-photo" onClick={onOpen} aria-label={`Open ${venue.name}`}>
      {venue.image && <img src={venue.image} alt={`${venue.name} interior`} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
      <span className="photo-label"><MapPin size={14} /> {venue.location}</span>
    </button>
    <div className="venue-card-content">
      <div className="venue-meta"><span>{venue.type}</span><span>{venue.floors.length} floors</span></div>
      <h3>{venue.name}</h3>
      <div className="venue-card-bottom"><span><Clock3 size={14} /> {venue.hours}</span><button className="text-button" onClick={onDetails}>Details <ArrowRight size={15} /></button></div>
    </div>
  </article>;
}

function SearchBox({ value, onChange, onFocus, onKeyDown, placeholder, leading = true, inputRef, className = '' }) {
  return <div className={`search-box ${className}`}>
    {leading && <Search className="search-leading" size={18} />}
    <input ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} onFocus={onFocus} onKeyDown={onKeyDown} placeholder={placeholder} aria-label={placeholder} />
    {value && <IconButton label="Clear search" onClick={() => onChange('')}><X size={16} /></IconButton>}
  </div>;
}

function RoutePanel({ route, steps, stepIndex, onSelectStep, onAdvance, destination, floorName, onRead, onShare, stepFree, onStepFree, navigationMode, trackingMessage, progressMeters, currentHeading, onStartNavigation, onPauseNavigation, onScan, t }) {
  const activeStep = steps[stepIndex];
  const isNavigating = navigationMode === 'sensor' || navigationMode === 'manual';
  const remaining = Math.max(0, Math.ceil((route.distanceMeters ?? route.distance) - progressMeters));
  const progressPercent = Math.min(100, Math.round(progressMeters / Math.max(1, route.distanceMeters ?? route.distance) * 100));
  const priorStep = () => {
    const nextIndex = Math.max(0, stepIndex - 1);
    if (steps[nextIndex]) onSelectStep(nextIndex);
  };
  const nextStep = () => {
    onAdvance();
  };
  return <section className="directions-panel" aria-label={t('directions')}>
    <div className="directions-topline"><span className="eyebrow">{t('directions')}</span><button className="text-button" onClick={onShare}><Send size={15} /> Share</button></div>
    <div className="route-destination"><span className="destination-icon"><MapPin size={19} /></span><div><strong>{destination.name}</strong><small>{floorName} · {t(destination.category === 'help' ? 'helpDesk' : destination.category)}</small></div></div>
    <div className="route-stats"><span><Navigation size={16} /> {route.distance} m</span><span><Clock3 size={16} /> about {route.minutes} min</span><span><Map size={16} /> {route.floors.length} {route.floors.length === 1 ? 'floor' : 'floors'}</span></div>
    <div className={`live-navigation${isNavigating ? ' is-active' : ''}`}>
      <div className="live-navigation-status"><span className="live-pulse" /><strong>{navigationMode === 'arrived' ? 'Arrived' : navigationMode === 'paused' ? 'Navigation paused' : isNavigating ? navigationMode === 'sensor' ? 'Motion tracking' : 'Waypoint guidance' : 'Ready to navigate'}</strong><span>{currentHeading != null && isNavigating ? `Facing ${currentHeading}` : isNavigating ? `${remaining} m left` : `${route.distance} m · ${route.minutes} min`}</span></div>
      <div className="live-progress-track" role="progressbar" aria-label="Route progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressPercent}><i style={{ width: `${progressPercent}%` }} /></div>
      {trackingMessage && <p>{trackingMessage}</p>}
      <div className="live-navigation-actions">
        {isNavigating ? <button className="button button-quiet" onClick={onPauseNavigation}><Pause size={16} /> Pause</button> : <button className="button button-primary" onClick={onStartNavigation}><Play size={16} /> {navigationMode === 'paused' ? 'Resume' : navigationMode === 'arrived' ? 'Start again' : 'Start navigation'}</button>}
        <button className="icon-button" title="Recalibrate at a location QR sign" aria-label="Recalibrate at a location QR sign" onClick={onScan}><QrCode size={17} /></button>
        {navigationMode === 'manual' && <button className="button button-outline" onClick={onAdvance} disabled={stepIndex >= steps.length - 1}>Next instruction</button>}
      </div>
    </div>
    <label className="switch-row"><span><Accessibility size={17} /> {t('stepFree')}</span><input type="checkbox" checked={stepFree} onChange={(event) => onStepFree(event.target.checked)} /><i /></label>
    <div className="step-current" aria-live="polite"><span className="step-count">{String(stepIndex + 1).padStart(2, '0')} <i>/</i> {String(steps.length).padStart(2, '0')}</span><p>{activeStep?.text}</p></div>
    <ol className="direction-list">
      {steps.map((step, index) => <li key={`${step.text}-${index}`} className={index === stepIndex ? 'step-active' : index < stepIndex ? 'step-done' : ''}>
        <button onClick={() => onSelectStep(index)} aria-current={index === stepIndex ? 'step' : undefined}><span className="step-marker">{index < stepIndex ? <Check size={12} /> : index + 1}</span><span>{step.text}</span></button>
      </li>)}
    </ol>
    <div className="directions-actions">
      <button className="button button-quiet" onClick={priorStep} disabled={stepIndex === 0}><ChevronLeft size={17} /> {t('back')}</button>
      <button className="button button-primary" onClick={nextStep} disabled={stepIndex === steps.length - 1}>{t('next')} <ChevronRight size={17} /></button>
    </div>
    <button className="button button-outline read-aloud" onClick={onRead}><AudioLines size={17} /> {t('readAloud')}</button>
  </section>;
}

function ScannerModal({ venues, currentVenue, onClose, onLocated }) {
  const [cameraStatus, setCameraStatus] = useState('Opening camera…');
  const [code, setCode] = useState('');
  const videoRef = useRef(null);
  const onLocatedRef = useRef(onLocated);
  onLocatedRef.current = onLocated;
  useEffect(() => {
    let stream;
    let active = true;
    let frameId;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) { setCameraStatus('Camera scanning is not available in this browser. Enter a sign code below.'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!active) { stream.getTracks().forEach((track) => track.stop()); return; }
        if (videoRef.current) videoRef.current.srcObject = stream;
        if (!('BarcodeDetector' in window)) { setCameraStatus('Camera ready. If QR scanning is unsupported, enter the printed sign code below.'); return; }
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        setCameraStatus('Point your camera at a WayIn QR sign.');
        const scan = async () => {
          if (!active || !videoRef.current || videoRef.current.readyState < 2) { frameId = requestAnimationFrame(scan); return; }
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) { onLocatedRef.current(codes[0].rawValue); return; }
          } catch { /* keep scanning */ }
          frameId = requestAnimationFrame(scan);
        };
        frameId = requestAnimationFrame(scan);
      } catch {
        setCameraStatus('Camera permission was unavailable. Enter a sign code or use a sample entrance.');
      }
    }
    start();
    return () => { active = false; cancelAnimationFrame(frameId); stream?.getTracks().forEach((track) => track.stop()); };
  }, []);

  function useCode(value) {
    if (value.trim().startsWith('http')) { onLocated(value.trim()); return true; }
    const parts = value.trim().split(/[|:]/).filter(Boolean);
    if (parts[0]?.toUpperCase() === 'WAYIN') parts.shift();
    if (parts.length < 2) return false;
    const venue = venues.find((item) => item.id === parts[0] || item.id.startsWith(parts[0]));
    const node = venue?.nodes.find((item) => item.id === parts[1] || item.id.endsWith(parts[1].toLowerCase()));
    if (!venue || !node) return false;
    onLocated({ venueId: venue.id, nodeId: node.id });
    return true;
  }
  const sample = `WAYIN|${currentVenue.id}|ground-entrance`;
  return <Modal title="Scan a WayIn sign" onClose={onClose} className="scanner-modal">
    <div className="scanner-view"><video ref={videoRef} autoPlay playsInline muted /><div className="scanner-frame"><span /><span /><span /><span /></div><p>{cameraStatus}</p></div>
    <div className="scanner-manual"><label htmlFor="qr-code-entry">Sign code</label><div className="form-row"><input id="qr-code-entry" value={code} onChange={(event) => setCode(event.target.value)} placeholder="WAYIN|city-mall|ground-entrance" /><button className="button button-primary" onClick={() => !useCode(code) && setCameraStatus('That sign code was not recognised. Try a sample sign.')}>Find me</button></div><button className="text-button sample-code" onClick={() => useCode(sample)}><LocateFixed size={15} /> Use this entrance as my location</button></div>
  </Modal>;
}

function PlaceDetails({ venue, place, favorite, onFavorite, onClose, onNavigate, onShare }) {
  const node = findNode(venue, place.nodeId);
  return <Modal title="Place details" onClose={onClose} className="details-modal">
    <div className="details-photo" style={{ backgroundImage: `linear-gradient(0deg, rgba(15,32,53,.65), transparent 80%), url(${venue.image})` }}><span>{venue.name}</span><h2>{place.name}</h2></div>
    <div className="details-copy"><div className="details-tags"><span>{categoryLabel[place.category]}</span><span>{node?.floorId === 'ground' ? 'Ground floor' : 'First floor'}</span></div><p>{place.description}</p><dl><div><dt>Hours</dt><dd>{place.hours}</dd></div><div><dt>Floor</dt><dd>{node?.floorId === 'ground' ? 'Ground floor' : 'First floor'}</dd></div></dl>
      <div className="details-actions"><button className="button button-primary" onClick={onNavigate}><Navigation size={17} /> Navigate here</button><button className="button button-quiet" onClick={onFavorite}><Heart size={17} fill={favorite ? 'currentColor' : 'none'} /> {favorite ? 'Saved' : 'Save'}</button><button className="icon-button" title="Share place" aria-label="Share place" onClick={onShare}><Send size={17} /></button></div>
    </div>
  </Modal>;
}

function QRModal({ title, value, onClose }) {
  return <Modal title={title} onClose={onClose} className="qr-modal"><div className="qr-code"><QRCodeSVG value={value} size={216} includeMargin bgColor="#ffffff" fgColor="#172a41" /></div><p>Scan this QR code to open the location in WayIn.</p><code>{value}</code><button className="button button-primary" onClick={() => window.print()}><QrCode size={17} /> Print QR code</button></Modal>;
}

function HomePage({ venues, search, setSearch, onOpen, onDetails, onScan, t }) {
  const visible = venues.filter((venue) => `${venue.name} ${venue.type} ${venue.location}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="home-page page-wrap">
    <section className="home-intro">
      <div className="intro-copy"><span className="eyebrow"><Compass size={15} /> YOUR INDOOR WAYFINDER</span><h1>{t('tagline')}</h1><p>Simple directions through the places you visit.</p></div>
      <button className="button button-outline scan-entry" onClick={onScan}><QrCode size={18} /> {t('scan')}</button>
    </section>
    <div className="venue-search-row"><SearchBox value={search} onChange={setSearch} placeholder={t('searchVenue')} className="venue-search" /><span className="secure-note"><LocateFixed size={15} /> No sign-in needed</span></div>
    <section className="venues-section"><div className="section-heading"><div><span className="eyebrow">EXPLORE</span><h2>Choose a venue</h2></div><span className="venue-count">{visible.length} {visible.length === 1 ? 'venue' : 'venues'}</span></div>
      {visible.length ? <div className="venue-grid">{visible.map((venue) => <VenueCard key={venue.id} venue={venue} onOpen={() => onOpen(venue)} onDetails={() => onDetails(venue)} />)}</div> : venues.length ? <EmptyState icon={Search} title="No venue found" body="Try searching by venue name or type." action="Clear search" onAction={() => setSearch('')} /> : <EmptyState icon={Map} title="No mapped venues yet" body="This site is waiting for its first building map." />}
    </section>
    <section className="home-note"><div className="note-icon"><Navigation size={19} /></div><div><strong>Know where you are. Know where to go.</strong><p>Choose a starting point, pick a destination and follow a clear route, floor by floor.</p></div>{venues[0] && <button className="text-button" onClick={() => onOpen(venues[0])}>Try {venues[0].name} <ArrowRight size={16} /></button>}</section>
    <footer className="site-footer"><Logo compact /><span>Indoor directions, made simple.</span><span>WayIn demo · {venues.length} sample venues</span></footer>
  </main>;
}

function NavigatorPage({ venue, startNodeId, setStartNodeId, destination, onPickPlace, search, setSearch, results, recentPlaces, category, setCategory, floorId, setFloorId, route, directions, stepIndex, setStepIndex, stepFree, setStepFree, blocked, onDetails, onFavorite, isFavorite, onScan, onRead, onShare, t }) {
  const routeKey = `${venue.id}:${route?.nodes.map((node) => node.id).join('|') ?? ''}`;
  const [searchOpen, setSearchOpen] = useState(false);
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [navigationMode, setNavigationMode] = useState('idle');
  const [navigationRouteKey, setNavigationRouteKey] = useState(routeKey);
  const [trackingMessage, setTrackingMessage] = useState('');
  const [progressMeters, setProgressMeters] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(null);
  const visiblePlaces = venue.places.filter((place) => category === 'all' || place.category === category);
  const searchMatches = results.slice(0, 6);
  const starts = venue.nodes.filter((node) => node.type !== 'junction');
  const blockedPlace = destination && blocked.includes(destination.id);
  const isNavigating = navigationMode === 'sensor' || navigationMode === 'manual';
  const currentPosition = useMemo(() => {
    if (!route || !isNavigating && navigationMode !== 'paused' && navigationMode !== 'arrived') return null;
    return { ...positionAlongRoute(route, progressMeters), progressMeters };
  }, [route, progressMeters, isNavigating, navigationMode]);

  useEffect(() => {
    if (navigationRouteKey === routeKey) return;
    setNavigationRouteKey(routeKey);
    setNavigationMode('idle');
    setTrackingMessage('');
    setProgressMeters(0);
    setCurrentHeading(null);
    setStepIndex(0);
  }, [navigationRouteKey, routeKey, setStepIndex]);

  useEffect(() => {
    if (!route || navigationRouteKey !== routeKey || navigationMode === 'idle') return;
    const nextStep = directions.reduce((current, step, index) => step.distanceMeters <= progressMeters ? index : current, 0);
    if (nextStep !== stepIndex) setStepIndex(nextStep);
    const position = positionAlongRoute(route, progressMeters);
    if (position && position.floorId !== floorId) setFloorId(position.floorId);
    if (progressMeters >= (route.distanceMeters ?? route.distance) && isNavigating) {
      setNavigationMode('arrived');
      setTrackingMessage('You have reached your destination.');
    }
  }, [route, directions, progressMeters, navigationMode, isNavigating, stepIndex, setStepIndex, floorId, setFloorId, navigationRouteKey, routeKey]);

  useEffect(() => {
    if (navigationMode !== 'sensor' || navigationRouteKey !== routeKey) return undefined;
    let receivedMotion = false;
    let lastStepAt = 0;
    let sampleTimer;
    const motionHandler = (event) => {
      const acceleration = event.acceleration;
      const gravity = event.accelerationIncludingGravity;
      const vector = acceleration && (acceleration.x != null || acceleration.y != null || acceleration.z != null) ? acceleration : gravity;
      if (!vector) return;
      receivedMotion = true;
      const magnitude = Math.hypot(vector.x ?? 0, vector.y ?? 0, vector.z ?? 0);
      const intensity = vector === gravity ? Math.abs(magnitude - 9.81) : magnitude;
      const now = Date.now();
      if (intensity > 1.45 && now - lastStepAt > 380) {
        lastStepAt = now;
        setProgressMeters((value) => Math.min(route.distanceMeters ?? route.distance, value + 0.72));
        setTrackingMessage('Step estimate active. Scan a location sign to correct drift.');
      }
    };
    const orientationHandler = (event) => {
      const heading = Number.isFinite(event.webkitCompassHeading) ? event.webkitCompassHeading : Number.isFinite(event.alpha) ? (360 - event.alpha + 360) % 360 : null;
      if (heading != null) setCurrentHeading(Math.round(heading / 45) % 8);
    };
    window.addEventListener('devicemotion', motionHandler);
    window.addEventListener('deviceorientation', orientationHandler);
    sampleTimer = window.setTimeout(() => {
      if (!receivedMotion) {
        setNavigationMode('manual');
        setTrackingMessage('No motion sensor signal. Use Next instruction as you walk.');
      }
    }, 4000);
    return () => {
      window.removeEventListener('devicemotion', motionHandler);
      window.removeEventListener('deviceorientation', orientationHandler);
      window.clearTimeout(sampleTimer);
    };
  }, [navigationMode, route, navigationRouteKey, routeKey]);

  async function startNavigation() {
    if (navigationMode === 'idle' || navigationMode === 'arrived') {
      setProgressMeters(0);
      setStepIndex(0);
      if (route?.nodes[0]) setFloorId(route.nodes[0].floorId);
    }
    let motionAllowed = Boolean(window.DeviceMotionEvent);
    try {
      const motionPermission = window.DeviceMotionEvent?.requestPermission;
      if (motionPermission) motionAllowed = await motionPermission.call(window.DeviceMotionEvent) === 'granted';
    } catch { motionAllowed = false; }
    try {
      const orientationPermission = window.DeviceOrientationEvent?.requestPermission;
      if (orientationPermission) await orientationPermission.call(window.DeviceOrientationEvent);
    } catch { setCurrentHeading(null); }
    setNavigationMode(motionAllowed ? 'sensor' : 'manual');
    setTrackingMessage(motionAllowed ? 'Step estimate active. Scan a location sign to correct drift.' : 'Motion sensors unavailable. Use Next instruction as you walk.');
  }

  function pauseNavigation() {
    setNavigationMode('paused');
    setTrackingMessage('Navigation paused. Your estimated position is saved.');
  }

  function selectInstruction(index) {
    const step = directions[index];
    if (!step) return;
    setStepIndex(index);
    if (navigationMode !== 'idle') setProgressMeters(step.distanceMeters ?? 0);
    setFloorId(step.floorId);
  }

  function advanceInstruction() {
    const nextIndex = Math.min(directions.length - 1, stepIndex + 1);
    const step = directions[nextIndex];
    if (!step) return;
    if (navigationMode !== 'idle') setProgressMeters(step.distanceMeters ?? progressMeters);
    setStepIndex(nextIndex);
    setFloorId(step.floorId);
  }

  const headingLabel = currentHeading == null ? null : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][currentHeading];

  return <main className="navigator-page page-wrap">
    <div className="navigator-heading"><div className="breadcrumb"><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent('wayin-home'))}><ChevronLeft size={16} /> All venues</button><span>/</span><strong>{venue.name}</strong></div><div className="venue-quick-actions"><button className="text-button" onClick={() => onScan()}><QrCode size={15} /> Scan location</button><button className={`icon-button${destination && isFavorite(destination) ? ' is-saved' : ''}`} title="Save this place" aria-label="Save this place" disabled={!destination} onClick={() => destination && onFavorite(venue, destination)}><Heart size={18} fill={destination && isFavorite(destination) ? 'currentColor' : 'none'} /></button></div></div>
    <div className="navigator-layout">
      <section className="navigation-main">
        <div className="route-searches">
          <div className="start-location"><span className="start-indicator" /><label htmlFor="start-select">{t('at')}</label><select id="start-select" value={startNodeId} onChange={(event) => event.target.value === 'scan-qr' ? onScan() : setStartNodeId(event.target.value)}>{starts.map((node) => <option key={node.id} value={node.id}>{node.label} · {venue.floors.find((floor) => floor.id === node.floorId)?.name}</option>)}<option value="scan-qr">Scan nearest QR…</option></select><ChevronDown size={17} /></div>
          <div className="destination-search-wrap"><SearchBox value={search} onChange={setSearch} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => event.key === 'Escape' && setSearchOpen(false)} placeholder={t('destination')} className="destination-search" />
            {searchOpen && search && <div className="autocomplete-list" role="listbox">{searchMatches.length ? searchMatches.map((place) => <button key={place.id} role="option" onClick={() => { onPickPlace(place); setSearchOpen(false); }}><span className="autocomplete-icon"><MapPin size={16} /></span><span><strong>{place.name}</strong><small>{categoryLabel[place.category]} · {venue.floors.find((floor) => floor.id === place.floorId)?.name}</small></span><ChevronRight size={16} /></button>) : <p className="autocomplete-empty">{t('noResults')}</p>}</div>}
            {!search && searchOpen && recentPlaces.length > 0 && <div className="autocomplete-list"><span className="autocomplete-title">{t('recent')}</span>{recentPlaces.slice(0, 4).map((place) => <button key={place.id} onClick={() => { onPickPlace(place); setSearchOpen(false); }}><Clock3 size={15} /><span><strong>{place.name}</strong><small>{venue.name}</small></span><ChevronRight size={16} /></button>)}</div>}
          </div>
          {searchOpen && <button className="click-away" aria-label="Close destination suggestions" onClick={() => setSearchOpen(false)} />}
        </div>
        <div className="category-row" aria-label="Place categories">{categories.map(({ id, label }) => {
          const Icon = iconForCategory[id] ?? ListFilter;
          const textKey = id === 'help' ? 'helpDesk' : id;
          return <button key={id} className={`category-chip${category === id ? ' active' : ''}`} onClick={() => setCategory(id)} aria-pressed={category === id}><Icon size={15} /> {t(textKey)}</button>;
        })}</div>
        <div className="map-section">
          <div className="map-section-heading"><div><span className="eyebrow">FLOOR PLAN</span><h2>{venue.name}</h2></div><button className="text-button map-list-toggle" onClick={() => setShowAllRooms((value) => !value)}><ListFilter size={15} /> {showAllRooms ? 'Hide places' : 'Places'} <ChevronDown size={14} className={showAllRooms ? 'rotate-up' : ''} /></button></div>
          <div className="floor-tabs" role="tablist" aria-label="Choose a floor">{venue.floors.map((floor) => <button key={floor.id} role="tab" aria-selected={floorId === floor.id} className={floorId === floor.id ? 'active' : ''} onClick={() => setFloorId(floor.id)}>{floor.name}{route?.floors.includes(floor.id) && <i className="floor-route-dot" />}</button>)}</div>
          <IndoorMap venue={venue} floorId={floorId} category={category} route={route} startNodeId={startNodeId} currentPosition={currentPosition} destination={destination} blocked={blocked} onSelectPlace={onDetails} />
          {showAllRooms && <div className="place-list" aria-label="Places on this floor">{visiblePlaces.filter((place) => place.floorId === floorId).map((place) => <button key={place.id} onClick={() => onPickPlace(place)}><span><MapPin size={15} /></span><strong>{place.name}</strong><small>{categoryLabel[place.category]}</small><ArrowRight size={15} /></button>)}{!visiblePlaces.some((place) => place.floorId === floorId) && <p>No places in this category on this floor.</p>}</div>}
        </div>
        <div className="map-footer"><span><Info size={15} /> Select any room on the map for details</span><span>Map updated recently</span></div>
      </section>
      <aside className="directions-column">
        {route && destination && !blockedPlace ? <RoutePanel route={route} steps={directions} stepIndex={stepIndex} onSelectStep={selectInstruction} onAdvance={advanceInstruction} destination={destination} floorName={`${venue.floors.find((floor) => floor.id === destination.floorId)?.name ?? 'Ground'} floor`} onRead={onRead} onShare={onShare} stepFree={stepFree} onStepFree={setStepFree} navigationMode={navigationMode} trackingMessage={trackingMessage} progressMeters={progressMeters} currentHeading={headingLabel} onStartNavigation={startNavigation} onPauseNavigation={pauseNavigation} onScan={onScan} t={t} /> : blockedPlace ? <EmptyState icon={ShieldAlert} title="This place is closed" body="The venue has temporarily blocked this location. Choose a different destination." /> : <EmptyState icon={Navigation} title="Ready when you are" body="Choose a destination above or tap a room on the map to see its route." />}
        <div className="nearby-panel"><div className="nearby-heading"><strong>On this floor</strong><span>{visiblePlaces.filter((place) => place.floorId === floorId).length} places</span></div>
          {visiblePlaces.filter((place) => place.floorId === floorId && !blocked.includes(place.id)).slice(0, 4).map((place) => { const Icon = iconForCategory[place.category] ?? MapPin; return <button key={place.id} onClick={() => onPickPlace(place)}><span className="nearby-icon"><Icon size={16} /></span><span><strong>{place.name}</strong><small>{categoryLabel[place.category]}</small></span><ChevronRight size={16} /></button>; })}
          <button className="nearby-emergency" onClick={() => { const exit = venue.places.find((place) => place.category === 'exits'); exit && onPickPlace(exit); }}><ShieldAlert size={16} /> Nearest emergency exit</button>
        </div>
      </aside>
    </div>
    <div className="mobile-route-bar">{route && destination ? <><span><strong>{isNavigating ? `${Math.max(0, Math.ceil((route.distanceMeters ?? route.distance) - progressMeters))} m left` : `${route.distance} m`}</strong><small>to {destination.name}</small></span><button className="button button-quiet" onClick={() => document.querySelector('.directions-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Navigation size={16} /> Directions</button>{isNavigating ? <button className="button button-primary" onClick={pauseNavigation}><Pause size={16} /> Pause</button> : <button className="button button-primary" onClick={startNavigation}><Play size={16} /> Start</button>}</> : <span>Choose a destination to start navigating</span>}</div>
  </main>;
}

function SavedPage({ favorites, recents, venues, onNavigate, onDetails, onClearRecents }) {
  const savedList = favorites.map((item) => ({ ...item, venue: venues.find((venue) => venue.id === item.venueId) })).filter((item) => item.venue);
  const recentList = recents.map((item) => ({ ...item, venue: venues.find((venue) => venue.id === item.venueId) })).filter((item) => item.venue);
  return <main className="content-page page-wrap"><div className="page-title-block"><span className="eyebrow">YOUR WAYIN</span><h1>Saved & recent</h1><p>Pick up where you left off.</p></div>
    <section className="saved-section"><div className="section-heading"><div><span className="eyebrow">QUICK ACCESS</span><h2>Saved places</h2></div><span className="venue-count">{savedList.length} saved</span></div>
      {savedList.length ? <div className="saved-grid">{savedList.map(({ venue, place }) => <PlaceCard key={`${venue.id}:${place.id}`} venue={venue} place={place} onNavigate={() => onNavigate(venue, place)} onDetails={() => onDetails(venue, place)} />)}</div> : <EmptyState icon={Heart} title="No saved places yet" body="Save a destination from its details to find it quickly next time." />}
    </section>
    <section className="saved-section"><div className="section-heading"><div><span className="eyebrow">RECENTLY VISITED</span><h2>Recent searches</h2></div>{recentList.length > 0 && <button className="text-button" onClick={onClearRecents}><Trash2 size={15} /> Clear history</button>}</div>
      {recentList.length ? <div className="recent-list">{recentList.map(({ venue, place }, index) => <button key={`${venue.id}:${place.id}:${index}`} onClick={() => onNavigate(venue, place)}><span className="recent-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{place.name}</strong><small>{venue.name} · {categoryLabel[place.category]}</small></span><ArrowRight size={17} /></button>)}</div> : <p className="muted-paragraph">Places you navigate to will appear here.</p>}
    </section>
  </main>;
}

function PlaceCard({ venue, place, onNavigate, onDetails }) {
  const Icon = iconForCategory[place.category] ?? MapPin;
  return <article className="saved-place-card"><div className="saved-place-top"><span className="nearby-icon"><Icon size={17} /></span><span>{categoryLabel[place.category]}</span></div><h3>{place.name}</h3><p>{venue.name} · {place.floorId === 'ground' ? 'Ground floor' : 'First floor'}</p><div><button className="text-button" onClick={onNavigate}>Navigate <ArrowRight size={15} /></button><button className="icon-button" onClick={onDetails} title="Place details" aria-label={`Details for ${place.name}`}><Info size={16} /></button></div></article>;
}

function HelpPage({ venues, onNavigate, onScan }) {
  const questions = [
    ['How do I find my starting point?', 'Choose a starting location from the “I am at” menu, or scan a WayIn QR sign near you.'],
    ['Can I use WayIn without an internet connection?', 'Maps and routes are cached on this device after your first visit. Venue photos may need a connection.'],
    ['How do step-free routes work?', 'Turn on Step-free route in the directions panel. WayIn will avoid stairs and use lifts where available.'],
    ['What if an area is blocked?', 'The route updates around closed areas when the venue has marked them temporarily unavailable.'],
  ];
  const [openFaq, setOpenFaq] = useState(0);
  const [sent, setSent] = useState(false);
  return <main className="content-page page-wrap"><div className="page-title-block"><span className="eyebrow">HERE TO HELP</span><h1>We’ll get you there.</h1><p>Quick answers and a direct line to the venue team.</p></div>
    <div className="help-layout"><section className="faq-section"><div className="section-heading"><div><span className="eyebrow">FAQ</span><h2>Common questions</h2></div></div>{questions.map(([question, answer], index) => <div className={`faq-item${openFaq === index ? ' open' : ''}`} key={question}><button onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span>{question}</span><Plus size={18} /></button>{openFaq === index && <p>{answer}</p>}</div>)}</section>
      <aside className="help-actions"><span className="help-graphic"><LifeBuoy size={28} /></span><h2>Need a person?</h2><p>Venue staff can help with access, directions and urgent assistance.</p><a className="button button-primary" href="tel:+18005550142"><Phone size={16} /> Call reception</a><button className="button button-outline" onClick={() => { const venue = venues[0]; const exit = venue.places.find((place) => place.category === 'exits'); if (exit) onNavigate(venue, exit); }}><ShieldAlert size={16} /> Nearest emergency exit</button><button className="text-button" onClick={onScan}><QrCode size={15} /> Scan a location sign</button></aside>
    </div>
    <section className="feedback-section"><div><span className="eyebrow">FEEDBACK</span><h2>Help us improve the map</h2><p>Tell us when something is missing or out of date.</p></div>{sent ? <div className="sent-state"><Check size={17} /> Feedback noted. Thank you.</div> : <form onSubmit={(event) => { event.preventDefault(); setSent(true); }}><input aria-label="Your feedback" required minLength={5} placeholder="What should we know?" /><button className="button button-primary" type="submit">Send feedback <Send size={15} /></button></form>}</section>
  </main>;
}

function AdminPage({ venues, setVenues, blocked, setBlocked, onShowQr }) {
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('wayin-admin-token') || '');
  const [authenticated, setAuthenticated] = useState(() => Boolean(sessionStorage.getItem('wayin-admin-token')));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [adminNotice, setAdminNotice] = useState('');
  const [storageMode, setStorageMode] = useState('checking');
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '');
  const [placeName, setPlaceName] = useState('');
  const [placeCategory, setPlaceCategory] = useState('help');
  const [placeFloor, setPlaceFloor] = useState('ground');
  const [editingId, setEditingId] = useState('');
  const [mapName, setMapName] = useState('');
  const [mapPreview, setMapPreview] = useState('');
  const [newVenueName, setNewVenueName] = useState('');
  const [newFloorName, setNewFloorName] = useState('');
  const [analytics, setAnalytics] = useState({ failedSearches: 3, topSearches: [{ name: 'Restrooms', count: 42 }, { name: 'Canteen', count: 31 }, { name: 'Main entrance', count: 28 }] });
  const selectedVenue = venues.find((venue) => venue.id === venueId) ?? venues[0];

  useEffect(() => {
    fetch('/api/health').then((response) => response.json()).then((result) => setStorageMode(result.storage || 'demo-memory')).catch(() => setStorageMode('demo-memory'));
  }, []);

  useEffect(() => {
    if (!authenticated || !adminToken) return;
    fetch('/api/admin/analytics', { headers: { Authorization: `Bearer ${adminToken}` } }).then((response) => response.ok ? response.json() : null).then((result) => result && setAnalytics(result)).catch(() => {});
  }, [authenticated, adminToken]);

  async function login(event) {
    event.preventDefault();
    setError('');
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The email or password did not match.');
      sessionStorage.setItem('wayin-admin-token', result.token);
      setAdminToken(result.token); setAuthenticated(true);
    } catch (loginError) { setError(loginError.message || 'Could not connect to the WayIn server.'); }
  }
  function logout() { sessionStorage.removeItem('wayin-admin-token'); setAdminToken(''); setAuthenticated(false); }
  function updatePlace(placeId, patch) {
    setVenues((current) => current.map((venue) => venue.id !== venueId ? venue : {
      ...venue,
      places: venue.places.map((place) => place.id === placeId ? { ...place, ...patch } : place),
      nodes: venue.nodes.map((node) => node.id === venue.places.find((place) => place.id === placeId)?.nodeId ? { ...node, label: patch.name ?? node.label } : node),
    }));
  }
  async function addPlace(event) {
    event.preventDefault();
    if (!placeName.trim() || !selectedVenue) return;
    if (editingId) {
      const patch = { name: placeName.trim(), mapLabel: placeName.trim().slice(0, 9), category: placeCategory };
      try {
        const response = await fetch(`/api/admin/venues/${selectedVenue.id}/places/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify(patch) });
        if (!response.ok) throw new Error('The place could not be saved to the server.');
      } catch (saveError) { setAdminNotice(saveError.message); return; }
      updatePlace(editingId, patch); setEditingId(''); setPlaceName(''); setAdminNotice('Place updated.'); return;
    }
    const id = `${selectedVenue.id}-custom-${Date.now()}`;
    const floorPlaces = selectedVenue.places.filter((place) => place.floorId === placeFloor).length;
    const slot = floorPlaces % 4;
    const x = 160 + slot * 210;
    const y = floorPlaces % 8 < 4 ? 130 : 430;
    const nodeId = `${placeFloor}-custom-${Date.now()}`;
    const parentId = `${placeFloor}-j${Math.min(4, Math.floor(slot / 1) + 1)}`;
    const place = { id, name: placeName.trim(), mapLabel: placeName.trim().slice(0, 9), category: placeCategory, floorId: placeFloor, nodeId, hours: selectedVenue.hours, description: 'Added by the venue team.' };
    const node = { id: nodeId, label: place.name, x, y, floorId: placeFloor, type: 'room' };
    const edge = { from: parentId, to: nodeId, mode: 'walk' };
    try {
      const response = await fetch('/api/admin/places', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ venueId: selectedVenue.id, place, node, edge }) });
      if (!response.ok) throw new Error('The place could not be saved to the server.');
    } catch (saveError) { setAdminNotice(saveError.message); return; }
    const next = venues.map((venue) => venue.id !== selectedVenue.id ? venue : {
      ...venue,
      places: [...venue.places, place],
      nodes: [...venue.nodes, node],
      edges: [...venue.edges, edge],
    });
    setVenues(next); setPlaceName(''); setAdminNotice('Place added to the map.');
  }
  async function toggleBlock(place) {
    const key = `${selectedVenue.id}:${place.id}`;
    const isClosed = !blocked.includes(key);
    try {
      const response = await fetch(`/api/admin/venues/${selectedVenue.id}/places/${place.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ isClosed }) });
      if (!response.ok) throw new Error('Closure status could not be saved to the server.');
    } catch (saveError) { setAdminNotice(saveError.message); return; }
    setBlocked((current) => isClosed ? [...current, key] : current.filter((item) => item !== key));
    setVenues((current) => current.map((venue) => venue.id !== selectedVenue.id ? venue : { ...venue, places: venue.places.map((item) => item.id === place.id ? { ...item, isClosed } : item) }));
    setAdminNotice(isClosed ? `${place.name} marked temporarily closed.` : `${place.name} reopened.`);
  }
  async function createVenue(event) {
    event.preventDefault();
    const name = newVenueName.trim();
    if (!name) return;
    const template = structuredClone(venues[0] ?? seedVenues[0]);
    const id = `venue-${Date.now()}`;
    const facilityIds = new Set(['main-entrance', 'restrooms', 'lift', 'stairs', 'parking', 'reception', 'atm']);
    template.id = id; template.name = name; template.type = 'Campus or venue'; template.location = 'Set venue location'; template.hours = 'Set venue hours'; template.image = null;
    template.places = template.places.filter((place) => facilityIds.has(place.id)).map((place) => ({ ...place, id: `${id}-${place.id}` }));
    const placeNodeIds = new Set(template.places.map((place) => place.nodeId));
    template.nodes = template.nodes.filter((node) => node.type !== 'room' || placeNodeIds.has(node.id));
    const nodeIds = new Set(template.nodes.map((node) => node.id));
    template.edges = template.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
    try {
      const response = await fetch('/api/admin/venues', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ venue: template }) });
      if (!response.ok) throw new Error('Venue map could not be saved to the server.');
    } catch (saveError) { setAdminNotice(saveError.message); return; }
    setVenues((current) => [...current, template]); setVenueId(id); setNewVenueName('');
  }
  async function addFloor(event) {
    event.preventDefault();
    if (!selectedVenue) return;
    const floorIndex = selectedVenue.floors.length;
    const floor = { id: `floor-${Date.now()}`, name: newFloorName.trim() || `Level ${floorIndex + 1}`, label: String(floorIndex) };
    const nodeList = [
      ['entrance', 'Upper hall', 76, 280, 'hall'],
      ['j1', 'West junction', 270, 280, 'junction'],
      ['j2', 'Central junction', 490, 280, 'junction'],
      ['j3', 'East junction', 710, 280, 'junction'],
      ['j4', 'East hall', 916, 280, 'junction'],
      ['lift', 'Lift', 710, 435, 'lift'],
      ['stairs', 'Stairs', 490, 435, 'stairs'],
      ['restrooms', 'Restrooms', 916, 435, 'restrooms'],
    ].map(([id, label, x, y, type]) => ({ id: `${floor.id}-${id}`, floorId: floor.id, label, x, y, type }));
    const edgeList = [
      ['entrance', 'j1', 'walk'], ['j1', 'j2', 'walk'], ['j2', 'j3', 'walk'], ['j3', 'j4', 'walk'],
      ['j3', 'lift', 'walk'], ['j2', 'stairs', 'walk'], ['j4', 'restrooms', 'walk'],
      [`${selectedVenue.floors.at(-1).id}-lift`, `${floor.id}-lift`, 'lift'],
      [`${selectedVenue.floors.at(-1).id}-stairs`, `${floor.id}-stairs`, 'stairs'],
    ].map(([from, to, mode]) => ({ from: from.includes('-') ? from : `${floor.id}-${from}`, to: to.includes('-') ? to : `${floor.id}-${to}`, mode, weight: mode === 'lift' ? 24 : mode === 'stairs' ? 15 : undefined }));
    const updated = { ...selectedVenue, floors: [...selectedVenue.floors, floor], nodes: [...selectedVenue.nodes, ...nodeList], edges: [...selectedVenue.edges, ...edgeList] };
    try {
      const response = await fetch('/api/admin/venues', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ venue: updated }) });
      if (!response.ok) throw new Error('The new floor could not be saved to the server.');
    } catch (saveError) { setAdminNotice(saveError.message); return; }
    setVenues((current) => current.map((venue) => venue.id === selectedVenue.id ? updated : venue));
    setNewFloorName(''); setAdminNotice(`${floor.name} added and linked by lift and stairs.`);
  }
  function loadMapFile(file) {
    if (!file) return;
    setMapName(file.name);
    const reader = new FileReader();
    reader.onload = () => setMapPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  if (!authenticated) return <main className="admin-login-wrap page-wrap"><div className="admin-login-card"><span className="admin-icon"><LockKeyhole size={24} /></span><span className="eyebrow">VENUE MANAGEMENT</span><h1>Admin sign in</h1><p>Manage venue maps, places and closures.</p><form onSubmit={login}><label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@venue.com" required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" type="submit">Sign in <ArrowRight size={16} /></button></form>{storageMode === 'demo-memory' ? <div className="demo-credentials"><strong>Local demo credentials</strong><span>admin@wayin.demo</span><span>wayin123</span></div> : storageMode === 'postgres' ? <div className="demo-credentials"><strong>Database mode</strong><span>Use the venue admin account</span></div> : null}</div></main>;

  return <main className="admin-page page-wrap"><div className="admin-top"><div><span className="eyebrow">VENUE MANAGEMENT</span><h1>Admin dashboard</h1><p>Update your map and keep visitors moving.</p></div><div className="admin-top-actions"><span className="admin-status"><i /> Signed in</span><button className="button button-quiet" onClick={logout}>Sign out</button></div></div>
    <div className="admin-stats"><div><span>VENUES</span><strong>{venues.length}</strong><small>active maps</small></div><div><span>PLACES</span><strong>{venues.reduce((sum, venue) => sum + venue.places.length, 0)}</strong><small>across all venues</small></div><div><span>CLOSED AREAS</span><strong>{blocked.length}</strong><small>temporary blocks</small></div><div><span>FAILED SEARCHES</span><strong>{analytics.failedSearches ?? 0}</strong><small>last 7 days</small></div></div>
    {adminNotice && <div className="admin-notice" role="status"><Info size={15} /> {adminNotice}<button aria-label="Dismiss" onClick={() => setAdminNotice('')}><X size={14} /></button></div>}
    <div className="admin-columns"><section className="admin-section venue-admin-section"><div className="admin-section-heading"><div><span className="eyebrow">VENUE & FLOORS</span><h2>Map setup</h2></div><select value={venueId} onChange={(event) => setVenueId(event.target.value)} aria-label="Choose venue" disabled={!venues.length}>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></div>
        <form className="create-venue-form" onSubmit={createVenue}><label htmlFor="new-venue-name">Create a venue</label><div><input id="new-venue-name" value={newVenueName} onChange={(event) => setNewVenueName(event.target.value)} placeholder="Venue name" /><button className="button button-outline" type="submit"><Plus size={16} /> Add venue</button></div></form>
        {selectedVenue ? <><div className="floor-admin-list">{selectedVenue.floors.map((floor) => <div key={floor.id}><span className="floor-admin-icon"><Map size={16} /></span><span><strong>{floor.name} floor</strong><small>{selectedVenue.nodes.filter((node) => node.floorId === floor.id).length} map points · {selectedVenue.places.filter((place) => place.floorId === floor.id).length} places</small></span><ChevronRight size={16} /></div>)}</div>
        <form className="create-floor-form" onSubmit={addFloor}><label htmlFor="new-floor-name">Add a floor</label><div><input id="new-floor-name" value={newFloorName} onChange={(event) => setNewFloorName(event.target.value)} placeholder={`e.g. Level ${selectedVenue?.floors.length ?? 2}`} /><button className="button button-outline" type="submit"><Plus size={16} /> Add floor</button></div></form>
        <label className="upload-map"><input type="file" accept="image/*,.svg" onChange={(event) => loadMapFile(event.target.files?.[0])} /><span className="upload-symbol"><Plus size={18} /></span><strong>{mapName || 'Upload floor plan'}</strong><small>Preview only · map points must be surveyed and mapped</small></label>{mapPreview && <img className="map-preview" src={mapPreview} alt="Uploaded floor plan preview" />}</> : <p className="admin-empty-note">Create a venue to set up its floors and navigation places.</p>}
      </section>
      <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">PLACE DIRECTORY</span><h2>Places & closures</h2></div><span className="venue-count">{selectedVenue?.places.length ?? 0} places</span></div>
        {selectedVenue ? <><form className="add-place-form" onSubmit={addPlace}><div className="form-row"><input aria-label="Place name" value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder={editingId ? 'Edit place name' : 'New place name'} required /><button className="button button-primary" type="submit">{editingId ? <Check size={16} /> : <Plus size={16} />}{editingId ? 'Save' : 'Add'}</button>{editingId && <button className="icon-button" type="button" aria-label="Cancel edit" onClick={() => { setEditingId(''); setPlaceName(''); }}><X size={16} /></button>}</div><div className="form-row"><select aria-label="Place category" value={placeCategory} onChange={(event) => setPlaceCategory(event.target.value)}>{categories.filter((category) => category.id !== 'all').map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}</select><select aria-label="Place floor" value={placeFloor} onChange={(event) => setPlaceFloor(event.target.value)} disabled={Boolean(editingId)}>{selectedVenue.floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}</select></div></form>
        <div className="admin-place-table"><div className="admin-table-head"><span>PLACE</span><span>FLOOR</span><span>STATUS</span><span>SIGN / EDIT</span></div>{selectedVenue.places.map((place) => { const isBlocked = blocked.includes(`${selectedVenue.id}:${place.id}`); return <div className="admin-place-row" key={place.id}><span><strong>{place.name}</strong><small>{categoryLabel[place.category]}</small></span><span>{selectedVenue.floors.find((floor) => floor.id === place.floorId)?.name}</span><span className={isBlocked ? 'status-closed' : 'status-open'}>{isBlocked ? 'Closed' : 'Open'}</span><span className="admin-row-actions"><button className="text-button" aria-label={`Print QR for ${place.name}`} title={`Print QR for ${place.name}`} onClick={() => onShowQr(selectedVenue, place)}><QrCode size={14} /></button><button className="text-button" aria-label={`Edit ${place.name}`} title={`Edit ${place.name}`} onClick={() => { setEditingId(place.id); setPlaceName(place.name); setPlaceCategory(place.category); setPlaceFloor(place.floorId); }}><Pencil size={13} /></button><button className={`text-button ${isBlocked ? 'reopen-action' : 'close-action'}`} onClick={() => toggleBlock(place)}>{isBlocked ? 'Reopen' : 'Close'}</button></span></div>; })}</div></> : <p className="admin-empty-note">Places can be added after you create a venue.</p>}
      </section></div>
    <section className="admin-analytics"><div><span className="eyebrow">SEARCH ACTIVITY</span><h2>Most searched</h2></div>{analytics.topSearches?.length ? analytics.topSearches.slice(0, 5).map((item, index) => <div className="analytics-row" key={item.name}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.name}</strong><small>{item.count} searches</small><i style={{ width: `${Math.max(8, item.count / (analytics.topSearches[0]?.count || item.count) * 100)}%` }} /></div>) : <p className="muted-paragraph">Search activity will appear as visitors use WayIn.</p>}</section>
    <div className="admin-note"><Info size={16} /><span>Without PostgreSQL, API edits live in server memory and this browser. Set up the database for persistent venue records and real search analytics.</span></div>
  </main>;
}

export default function App() {
  const [venues, setVenues] = useState(() => readStore('wayin-venues', seedVenues));
  const [hadSavedVenueData] = useState(() => Boolean(localStorage.getItem('wayin-venues')));
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('view') === 'admin' ? 'admin' : 'home');
  const [activeVenueId, setActiveVenueId] = useState('');
  const [startNodeId, setStartNodeId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [homeSearch, setHomeSearch] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [floorId, setFloorId] = useState('ground');
  const [stepIndex, setStepIndex] = useState(0);
  const [stepFree, setStepFree] = useState(false);
  const [favorites, setFavorites] = useState(() => readStore('wayin-favorites', []));
  const [recents, setRecents] = useState(() => readStore('wayin-recents', []));
  const [blocked, setBlocked] = useState(() => readStore('wayin-blocked', []));
  const [language, setLanguage] = useState(() => localStorage.getItem('wayin-language') || 'en');
  const [theme, setTheme] = useState(() => localStorage.getItem('wayin-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrValue, setQrValue] = useState('');
  const [toast, setToast] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sharedLinkProcessed, setSharedLinkProcessed] = useState(false);
  const [venuesLoaded, setVenuesLoaded] = useState(false);
  const t = (key) => translate(language, key);

  const activeVenue = venues.find((venue) => venue.id === activeVenueId) ?? venues[0];
  const destination = activeVenue?.places.find((place) => place.id === destinationId) ?? null;
  const isClosed = destination && blocked.includes(`${activeVenue.id}:${destination.id}`);
  const route = useMemo(() => activeVenue && destination && !isClosed ? shortestRoute(activeVenue, startNodeId || activeVenue.startNodeId, destination.nodeId, { stepFree }) : null, [activeVenue, destination, startNodeId, stepFree, isClosed]);
  const directions = useMemo(() => route && destination ? routeDirections(route, destination, activeVenue, language) : [], [route, destination, activeVenue, language]);
  const routePlaceResults = useMemo(() => activeVenue ? searchPlaces(activeVenue.places, destinationSearch) : [], [activeVenue, destinationSearch]);
  const activeBlocked = activeVenue ? blocked.filter((item) => item.startsWith(`${activeVenue.id}:`)).map((item) => item.slice(activeVenue.id.length + 1)) : [];

  useEffect(() => { writeStore('wayin-venues', venues); }, [venues]);
  useEffect(() => { writeStore('wayin-favorites', favorites); }, [favorites]);
  useEffect(() => { writeStore('wayin-recents', recents); }, [recents]);
  useEffect(() => { writeStore('wayin-blocked', blocked); }, [blocked]);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('wayin-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('wayin-language', language); document.documentElement.lang = language; }, [language]);
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 3000); return () => window.clearTimeout(timer); }, [toast]);

  useEffect(() => {
    fetch('/api/venues').then(async (response) => {
      if (!response.ok) return;
      const result = await response.json();
      const source = response.headers.get('X-Wayin-Source');
      if (!hadSavedVenueData || source === 'postgres') setVenues(result);
      if (source === 'postgres') setBlocked(result.flatMap((venue) => venue.places.filter((place) => place.isClosed).map((place) => `${venue.id}:${place.id}`)));
    }).catch(() => {}).finally(() => setVenuesLoaded(true));
  }, []);

  useEffect(() => {
    const query = destinationSearch.trim();
    if (!activeVenue || query.length < 3 || routePlaceResults.length) return undefined;
    const timer = window.setTimeout(() => {
      fetch('/api/search-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueId: activeVenue.id, query, succeeded: false }) }).catch(() => {});
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeVenue, destinationSearch, routePlaceResults]);

  useEffect(() => {
    const onHome = () => { setView('home'); setMobileMenuOpen(false); };
    window.addEventListener('wayin-home', onHome);
    return () => window.removeEventListener('wayin-home', onHome);
  }, []);

  useEffect(() => {
    if (sharedLinkProcessed) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('venue')) { setSharedLinkProcessed(true); return; }
    const venue = venues.find((item) => item.id === params.get('venue'));
    if (!venue && !venuesLoaded) return;
    if (!venue) { setSharedLinkProcessed(true); return; }
    const place = params.get('place') ? venue.places.find((item) => item.id === params.get('place')) : null;
    const node = params.get('node') ? venue.nodes.find((item) => item.id === params.get('node')) : null;
    if ((params.has('place') && !place || params.has('node') && !node) && !venuesLoaded) return;
    if (place || node) {
      setActiveVenueId(venue.id);
      setStartNodeId(node?.id ?? venue.startNodeId);
      setDestinationId(place?.id ?? '');
      setFloorId(node?.floorId ?? 'ground');
      setView('navigator');
    }
    setSharedLinkProcessed(true);
  }, [venues, sharedLinkProcessed, venuesLoaded]);

  function openVenue(venue) {
    setActiveVenueId(venue.id); setStartNodeId(venue.startNodeId); setDestinationId(''); setDestinationSearch(''); setFloorId('ground'); setCategory('all'); setStepIndex(0); setView('navigator');
  }
  function openPlace(venue, place) {
    setActiveVenueId(venue.id); setStartNodeId((current) => venue.id === activeVenueId && current ? current : venue.startNodeId); setDestinationId(place.id); setDestinationSearch(''); setFloorId('ground'); setCategory('all'); setStepIndex(0); setView('navigator');
    setRecents((current) => [{ venueId: venue.id, placeId: place.id, name: place.name, timestamp: Date.now() }, ...current.filter((item) => !(item.venueId === venue.id && item.placeId === place.id))].slice(0, 12));
  }
  function isFavorite(venue, place) { return favorites.some((item) => item.venueId === venue.id && item.placeId === place.id); }
  function toggleFavorite(venue, place) {
    const already = isFavorite(venue, place);
    setFavorites((current) => already ? current.filter((item) => !(item.venueId === venue.id && item.placeId === place.id)) : [{ venueId: venue.id, placeId: place.id, name: place.name }, ...current]);
    setToast(already ? 'Removed from saved places' : 'Saved for next time');
  }
  function openDetails(venue, place) { setDetailsTarget({ venue, place }); }
  function sharePlace(venue, place) {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ venue: venue.id, place: place.id }).toString();
    setQrValue(url.toString());
    if (navigator.share) navigator.share({ title: `${place.name} · WayIn`, url: url.toString() }).catch(() => {});
    else navigator.clipboard?.writeText(url.toString()).then(() => setToast('Route link copied')).catch(() => {});
  }
  function showLocationQr(venue, place) {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ venue: venue.id, node: place.nodeId }).toString();
    setQrValue(url.toString());
  }
  function handleQrLocated(value) {
    let result = value;
    if (typeof value === 'string' && value.startsWith('http')) {
      try {
        const url = new URL(value);
        const venueId = url.searchParams.get('venue');
        const placeId = url.searchParams.get('place');
        const venue = venues.find((item) => item.id === venueId);
        const place = venue?.places.find((item) => item.id === placeId);
        if (venue && place) {
          setActiveVenueId(venue.id); setStartNodeId(url.searchParams.get('node') || venue.startNodeId); setDestinationId(place.id); setFloorId('ground'); setView('navigator'); setScannerOpen(false); setToast(`Route opened for ${place.name}`); return;
        }
        result = { venueId, nodeId: url.searchParams.get('node') };
      } catch { result = value; }
    }
    if (typeof result === 'string') {
      const parts = result.trim().split(/[|:]/).filter(Boolean);
      if (parts[0]?.toUpperCase() === 'WAYIN') parts.shift();
      result = { venueId: parts[0], nodeId: parts[1] };
    }
    const venue = venues.find((item) => item.id === result.venueId);
    const node = venue?.nodes.find((item) => item.id === result.nodeId || item.id.endsWith(String(result.nodeId).toLowerCase()));
    if (!venue || !node) { setToast('That WayIn sign could not be recognised'); return; }
    const keepDestination = venue.id === activeVenueId && venue.places.some((place) => place.id === destinationId) ? destinationId : '';
    setActiveVenueId(venue.id); setStartNodeId(node.id); setFloorId(node.floorId); setDestinationId(keepDestination); setStepIndex(0); setView('navigator'); setScannerOpen(false); setToast(keepDestination ? `Location reset at ${node.label}` : `Starting point set to ${node.label}`);
  }
  function readDirections() {
    if (!directions[stepIndex] || !('speechSynthesis' in window)) { setToast('Voice guidance is not supported in this browser'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(directions[stepIndex].text);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
    window.speechSynthesis.speak(utterance);
  }
  function shareRoute() { if (activeVenue && destination) sharePlace(activeVenue, destination); }
  function setCurrentDestination(place) {
    fetch('/api/search-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueId: activeVenue.id, query: destinationSearch || place.name, succeeded: true }) }).catch(() => {});
    openPlace(activeVenue, place);
  }
  function setCurrentCategory(id) { setCategory(id); setDestinationSearch(''); }
  function openAdmin() { setView('admin'); setMobileMenuOpen(false); }

  return <div className="app-shell">
    <header className="topbar"><button className="mobile-menu-trigger icon-button" aria-label="Open navigation" onClick={() => setMobileMenuOpen((value) => !value)}><Menu size={20} /></button><button className="brand-button" onClick={() => { setView('home'); setDestinationId(''); }}><Logo /></button>
      <nav className={`top-navigation${mobileMenuOpen ? ' mobile-open' : ''}`} aria-label="Main navigation"><button className={view === 'home' || view === 'navigator' ? 'active' : ''} onClick={() => { setView('home'); setMobileMenuOpen(false); }}><Home size={16} /> {t('venues')}</button><button className={view === 'saved' ? 'active' : ''} onClick={() => { setView('saved'); setMobileMenuOpen(false); }}><Bookmark size={16} /> {t('favorites')}{favorites.length > 0 && <i className="nav-count">{favorites.length}</i>}</button><button className={view === 'help' ? 'active' : ''} onClick={() => { setView('help'); setMobileMenuOpen(false); }}><LifeBuoy size={16} /> {t('help')}</button><button className={view === 'admin' ? 'active' : ''} onClick={openAdmin}><Settings2 size={16} /> {t('admin')}</button></nav>
      <div className="topbar-actions"><button className="utility-button language-button" onClick={() => setLanguage((value) => value === 'en' ? 'hi' : 'en')} aria-label="Switch language"><Languages size={17} /><span>{language === 'en' ? 'EN' : 'हि'}</span></button><IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</IconButton><button className="account-dot" aria-label="Visitor mode" title="Visitor mode"><span>V</span></button></div>
    </header>

    {view === 'home' && <HomePage venues={venues} search={homeSearch} setSearch={setHomeSearch} onOpen={openVenue} onDetails={(venue) => setDetailsTarget({ venue, place: venue.places[0] })} onScan={() => { if (!activeVenue) return; setScannerOpen(true); }} t={t} />}
    {view === 'navigator' && activeVenue && <NavigatorPage venue={activeVenue} startNodeId={startNodeId || activeVenue.startNodeId} setStartNodeId={setStartNodeId} destination={destination} onPickPlace={setCurrentDestination} search={destinationSearch} setSearch={setDestinationSearch} results={routePlaceResults} recentPlaces={recents.filter((item) => item.venueId === activeVenue.id).map((item) => activeVenue.places.find((place) => place.id === item.placeId)).filter(Boolean)} category={category} setCategory={setCurrentCategory} floorId={floorId} setFloorId={setFloorId} route={route} directions={directions} stepIndex={stepIndex} setStepIndex={setStepIndex} stepFree={stepFree} setStepFree={setStepFree} blocked={activeBlocked} onDetails={(place) => openDetails(activeVenue, place)} onFavorite={toggleFavorite} isFavorite={(place) => isFavorite(activeVenue, place)} onScan={() => setScannerOpen(true)} onRead={readDirections} onShare={shareRoute} t={t} />}
    {view === 'saved' && <SavedPage favorites={favorites.map((item) => ({ ...item, place: venues.find((venue) => venue.id === item.venueId)?.places.find((place) => place.id === item.placeId) })).filter((item) => item.place)} recents={recents.map((item) => ({ ...item, place: venues.find((venue) => venue.id === item.venueId)?.places.find((place) => place.id === item.placeId) })).filter((item) => item.place)} venues={venues} onNavigate={openPlace} onDetails={openDetails} onClearRecents={() => setRecents([])} />}
    {view === 'help' && <HelpPage venues={venues} onNavigate={openPlace} onScan={() => { setActiveVenueId(venues[0].id); setScannerOpen(true); }} />}
    {view === 'admin' && <AdminPage venues={venues} setVenues={setVenues} blocked={blocked} setBlocked={setBlocked} onShowQr={showLocationQr} />}

    {detailsTarget && <PlaceDetails venue={detailsTarget.venue} place={detailsTarget.place} favorite={isFavorite(detailsTarget.venue, detailsTarget.place)} onFavorite={() => toggleFavorite(detailsTarget.venue, detailsTarget.place)} onClose={() => setDetailsTarget(null)} onNavigate={() => { openPlace(detailsTarget.venue, detailsTarget.place); setDetailsTarget(null); }} onShare={() => sharePlace(detailsTarget.venue, detailsTarget.place)} />}
    {scannerOpen && activeVenue && <ScannerModal venues={venues} currentVenue={activeVenue} onClose={() => setScannerOpen(false)} onLocated={handleQrLocated} />}
    {qrValue && <QRModal title={qrValue.includes('node=') ? 'Print a location QR sign' : 'Share this WayIn route'} value={qrValue} onClose={() => setQrValue('')} />}
    {toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}
  </div>;
}
