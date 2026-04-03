// Update year (Handled by layout.js)
// document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav toggle with ARIA (Handled by layout.js)
// const navToggle = document.querySelector('.nav-toggle');
// const nav = document.getElementById('primary-nav');
// if (navToggle && nav) {
//   navToggle.addEventListener('click', () => {
//     const expanded = nav.getAttribute('aria-expanded') === 'true';
//     nav.setAttribute('aria-expanded', String(!expanded));
//     navToggle.setAttribute('aria-expanded', String(!expanded));
//   });
//   document.addEventListener('keydown', (e) => {
//     if (e.key === 'Escape') {
//       nav.setAttribute('aria-expanded', 'false');
//       navToggle.setAttribute('aria-expanded', 'false');
//     }
//   });
// }

// Skip link focus (Handled by layout.js)
// const skipLink = document.querySelector('.skip-link');
// if (skipLink) {
//   skipLink.addEventListener('click', () => {
//     const target = document.querySelector(skipLink.getAttribute('href'));
//     if (target) target.setAttribute('tabindex', '-1'), target.focus();
//   });
// }

// Reveal on scroll (IntersectionObserver)
const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    }),
    { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
  );
  reveals.forEach((el) => observer.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('revealed'));
}

/* 3D stage interaction: tilt and parallax */
(() => {
  const stageWrap = document.querySelector('.three-d-stage');
  const stage = document.querySelector('.stage');
  if (!stageWrap || !stage) return;

  const maxTilt = 8; // degrees
  const depthMap = {
    'card--panel': 40,
    'card--map': 10
  };

  function setTransform(xDeg, yDeg) {
    // read CSS scale (responsive) and apply with rotation
    const rootStyle = getComputedStyle(document.documentElement);
    const scaleVal = parseFloat(rootStyle.getPropertyValue('--stage-scale')) || 1;
    stage.style.transform = `rotateX(${xDeg}deg) rotateY(${yDeg}deg) scale(${scaleVal})`;
    // parallax child cards (use CSS variable depths where possible)
    stage.querySelectorAll('.card').forEach((c) => {
      const isPanel = c.classList.contains('card--panel');
      const depthCss = isPanel ? rootStyle.getPropertyValue('--card-panel-depth') : rootStyle.getPropertyValue('--card-map-depth');
      const depth = depthCss ? depthCss.trim() : (isPanel ? '40px' : '10px');
      c.style.transform = `translateZ(${depth})`;
    });
  }

  function onMove(e) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = stageWrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = (clientX - cx) / rect.width;
    const dy = (clientY - cy) / rect.height;
    const yDeg = dx * maxTilt;
    const xDeg = -dy * maxTilt;
    setTransform(xDeg, yDeg);
  }

  function onLeave() { setTransform(0, 0); }

  stageWrap.addEventListener('mousemove', onMove);
  stageWrap.addEventListener('touchmove', onMove, { passive: true });
  stageWrap.addEventListener('mouseleave', onLeave);
  stageWrap.addEventListener('touchend', onLeave);
})();

/* Azure Maps integration */
let map, datasource, routeLayer;

// Live Location Tracking State
const liveTracking = {
  active: false,
  watchId: null,
  currentLocation: null,
  destination: null,
  lastRecalculatedAt: 0,
  recalculationThreshold: 50, // meters - recalculate if moved this distance
  minRecalculationInterval: 3000 // milliseconds - don't recalculate more than once per 3 seconds
};

// Turn-by-Turn Navigation State
const navigationState = {
  routeSegments: [], // Array of route segments with turn info
  currentSegmentIndex: 0,
  nextTurnDistance: 0, // Distance to next turn in meters
  nextTurnDirection: '', // 'left', 'right', 'straight', 'arrive'
  totalDistanceRemaining: 0,
  instructions: [] // Array of navigation instructions
};

// AI Chatbot Assistant State
const aiAssistant = {
  conversationHistory: [],
  currentUserLocation: null,
  currentDestination: null,
  suggestedRoutes: [],
  preferences: {
    avoidNoisy: true,
    preferGreenSpaces: true,
    allowDetours: true
  }
};

// Community Reports Storage
const communityReports = {
  noise: [],
  crowds: [],
  construction: []
};

// AI Comfort Prediction Engine
const comfortAI = {
  predict: function (location, time) {
    const hour = new Date(time).getHours();
    const baseComfort = 0.7;
    const rushHourPenalty = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19) ? -0.3 : 0;
    const nearbyReports = this.getNearbyReports(location);
    const reportPenalty = nearbyReports.length * -0.1;
    return Math.max(0, Math.min(1, baseComfort + rushHourPenalty + reportPenalty));
  },
  getNearbyReports: function (location) {
    return [...communityReports.noise, ...communityReports.crowds, ...communityReports.construction]
      .filter(r => Math.hypot(r.coords[0] - location[0], r.coords[1] - location[1]) < 0.02);
  }
};

// Report Noise Zone
function reportNoiseZone(coords, level, description) {
  fetch('http://localhost:3000/api/reports/noise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coords, level, description })
  })
    .then(res => res.json())
    .then(report => {
      communityReports.noise.push(report);
      addReportMarker(report, 'noise');
      updateReportsCount();
    })
    .catch(() => {
      const report = { coords, level, description, timestamp: Date.now() };
      communityReports.noise.push(report);
      addReportMarker(report, 'noise');
      updateReportsCount();
    });
}

// Report Crowded Area
function reportCrowdedArea(coords, density, description) {
  fetch('http://localhost:3000/api/reports/crowd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coords, density, description })
  })
    .then(res => res.json())
    .then(report => {
      communityReports.crowds.push(report);
      addReportMarker(report, 'crowd');
      updateReportsCount();
    })
    .catch(() => {
      const report = { coords, density, description, timestamp: Date.now() };
      communityReports.crowds.push(report);
      addReportMarker(report, 'crowd');
      updateReportsCount();
    });
}

// Report Construction Zone
function reportConstruction(coords, description) {
  fetch('http://localhost:3000/api/reports/construction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coords, description })
  })
    .then(res => res.json())
    .then(report => {
      communityReports.construction.push(report);
      addReportMarker(report, 'construction');
      updateReportsCount();
    })
    .catch(() => {
      const report = { coords, description, timestamp: Date.now() };
      communityReports.construction.push(report);
      addReportMarker(report, 'construction');
      updateReportsCount();
    });
}

// Load reports from backend
function loadReports() {
  fetch('http://localhost:3000/api/reports')
    .then(res => res.json())
    .then(data => {
      communityReports.noise = data.noise;
      communityReports.crowds = data.crowds;
      communityReports.construction = data.construction;
      data.noise.forEach(r => addReportMarker(r, 'noise'));
      data.crowds.forEach(r => addReportMarker(r, 'crowd'));
      data.construction.forEach(r => addReportMarker(r, 'construction'));
      updateReportsCount();
    })
    .catch(() => console.log('Backend offline, using local mode'));
}

// Add marker to map
function addReportMarker(report, type) {
  if (!map || !datasource) return;
  const colors = { noise: '#ef4444', crowd: '#f59e0b', construction: '#8b5cf6' };
  const point = new atlas.data.Feature(new atlas.data.Point(report.coords), {
    type,
    color: colors[type],
    description: report.description
  });
  datasource.add(point);
}

// Update map with community reports
function updateMapWithReports() {
  if (!map || !datasource) return;
  const allReports = [...communityReports.noise, ...communityReports.crowds, ...communityReports.construction];
  allReports.forEach(report => {
    const point = new atlas.data.Feature(new atlas.data.Point(report.coords), { type: 'report' });
    datasource.add(point);
  });
}

// Update community reports count in UI
function updateReportsCount() {
  const counter = document.getElementById('community-reports-count');
  if (counter) {
    const total = communityReports.noise.length + communityReports.crowds.length + communityReports.construction.length;
    counter.textContent = `${total} community reports`;
  }
}

window.reportNoiseZone = reportNoiseZone;
window.reportCrowdedArea = reportCrowdedArea;
window.reportConstruction = reportConstruction;
window.comfortAI = comfortAI;
window.communityReports = communityReports;
window.updateReportsCount = updateReportsCount;
window.loadReports = loadReports;

function initMap() {
  map = new atlas.Map('azureMap', {
    center: [77.4538, 28.6692], // Ghaziabad approx
    zoom: 11,
    style: 'road',
    language: 'en-US',
    authOptions: {
      authType: 'subscriptionKey',
      subscriptionKey: 'YOUR_AZURE_MAPS_KEY' // TODO: replace with your key
    }
  });

  map.events.add('ready', () => {
    datasource = new atlas.source.DataSource();
    map.sources.add(datasource);

    loadReports();

    // Heat layers (quiet vs noisy)
    const noisyPoints = [
      [77.433, 28.650], [77.445, 28.655], [77.455, 28.665],
      [77.470, 28.640], [77.480, 28.645], [77.500, 28.635]
    ].map((c) => new atlas.data.Feature(new atlas.data.Point(c), { level: 1.0 }));

    const quietPoints = [
      [77.390, 28.700], [77.410, 28.690], [77.420, 28.715],
      [77.460, 28.700], [77.470, 28.720]
    ].map((c) => new atlas.data.Feature(new atlas.data.Point(c), { level: 0.2 }));

    const noisyDs = new atlas.source.DataSource();
    const quietDs = new atlas.source.DataSource();
    noisyDs.add(noisyPoints);
    quietDs.add(quietPoints);

    map.sources.add(noisyDs);
    map.sources.add(quietDs);

    map.layers.add(new atlas.layer.HeatMapLayer(quietDs, 'quiet-heat', {
      radius: 18,
      colorGradient: [
        'rgba(0,0,0,0)',
        'rgba(22,197,94,0.35)',
        'rgba(22,197,94,0.65)'
      ],
      opacity: 0.8,
      weightExpression: ['get', 'level']
    }));

    map.layers.add(new atlas.layer.HeatMapLayer(noisyDs, 'noisy-heat', {
      radius: 20,
      colorGradient: [
        'rgba(0,0,0,0)',
        'rgba(239,68,68,0.35)',
        'rgba(239,68,68,0.8)'
      ],
      opacity: 0.9,
      weightExpression: ['get', 'level']
    }));

    // Route layer placeholder
    routeLayer = new atlas.layer.LineLayer(datasource, 'comfort-route', {
      strokeColor: '#0EA5A2',
      strokeWidth: 5,
      lineJoin: 'round',
      lineCap: 'round',
      opacity: 0.9
    });
    map.layers.add(routeLayer);

    // Pins for origin/destination
    const origin = new atlas.data.Feature(new atlas.data.Point([77.4538, 28.6692]));
    const destination = new atlas.data.Feature(new atlas.data.Point([77.4316, 28.6384]));
    datasource.add([origin, destination]);

    map.layers.add(new atlas.layer.SymbolLayer(datasource, null, {
      iconOptions: {
        image: 'marker-red',
        allowOverlap: true,
        size: 0.8
      },
      filter: ['any', ['==', ['get', 'type'], 'noise'], ['==', ['get', 'type'], 'crowd'], ['==', ['get', 'type'], 'construction']]
    }));

    // Add popup on marker click
    map.events.add('click', datasource, (e) => {
      if (e.shapes && e.shapes.length > 0) {
        const props = e.shapes[0].getProperties();
        if (props.description) {
          new atlas.Popup({
            content: `<div style="padding:10px"><b>${props.type}</b><br>${props.description}</div>`,
            position: e.shapes[0].getCoordinates()
          }).open(map);
        }
      }
    });
  });
}

// Function to plan and display comfortable route from external form data
function planComfortableRoute(originCoords, destCoords, enableLiveTracking = false) {
  if (!map || !datasource) {
    console.error('Map not initialized');
    return;
  }

  // Clear existing routes and pins (but preserve report markers)
  const reportMarkers = datasource.getShapes().filter(f => {
    const props = f.getProperties();
    return props && (props.type === 'noise' || props.type === 'crowd' || props.type === 'construction');
  });

  datasource.clear();
  reportMarkers.forEach(marker => datasource.add(marker));

  // Add new origin and destination pins
  const origin = new atlas.data.Feature(new atlas.data.Point(originCoords), { name: 'Origin', isOrigin: true });
  const destination = new atlas.data.Feature(new atlas.data.Point(destCoords), { name: 'Destination', isDestination: true });

  // Create comfort-aware route avoiding noisy areas
  const comfortRoute = generateComfortRoute(originCoords, destCoords);
  const routeFeature = new atlas.data.Feature(comfortRoute, { isRoute: true });

  datasource.add([origin, destination, routeFeature]);

  // Center map on the route
  const bounds = atlas.data.BoundingBox.fromData([origin, destination]);
  map.setCamera({ bounds: bounds, padding: 50 });

  // Extract route coordinates and setup turn-by-turn navigation
  try {
    const routeCoordinates = comfortRoute.getCoordinates();
    if (routeCoordinates && routeCoordinates.length >= 2) {
      setupTurnByTurnNavigation(routeCoordinates);
      console.log('🧭 Turn-by-turn navigation initialized with', routeCoordinates.length, 'waypoints');
    }
  } catch (error) {
    console.error('❌ Error setting up turn-by-turn navigation:', error);
  }

  // Start live tracking if enabled
  if (enableLiveTracking) {
    startLiveLocationTracking(destCoords);
  }

  console.log('🗺️ Route planned from', originCoords, 'to', destCoords);
}

// Calculate bearing between two coordinates
function calculateBearing(from, to) {
  const lat1 = from[1] * Math.PI / 180;
  const lat2 = to[1] * Math.PI / 180;
  const dLon = (to[0] - from[0]) * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  
  return (bearing + 360) % 360; // Normalize to 0-360
}

// Determine turn direction based on bearing change
function determineTurnDirection(fromBearing, toBearing) {
  let turn = toBearing - fromBearing;
  
  // Normalize to -180 to 180
  while (turn > 180) turn -= 360;
  while (turn < -180) turn += 360;
  
  if (Math.abs(turn) < 15) return 'straight';
  if (turn > 0) return 'left';
  return 'right';
}

// Calculate distance between two coordinates in meters (approximate)
function calculateDistance(from, to) {
  const R = 6371000; // Earth radius in meters
  const lat1 = from[1] * Math.PI / 180;
  const lat2 = to[1] * Math.PI / 180;
  const dLat = (to[1] - from[1]) * Math.PI / 180;
  const dLon = (to[0] - from[0]) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in meters
}

// Generate turn-by-turn instructions from route coordinates
function generateTurns(routeCoordinates) {
  const turns = [];
  
  if (routeCoordinates.length < 2) return turns;
  
  // Analyze segments for turns
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const segment = {
      from: routeCoordinates[i],
      to: routeCoordinates[i + 1],
      distance: calculateDistance(routeCoordinates[i], routeCoordinates[i + 1]),
      bearing: calculateBearing(routeCoordinates[i], routeCoordinates[i + 1])
    };
    
    if (i > 0) {
      const prevBearing = calculateBearing(routeCoordinates[i - 1], routeCoordinates[i]);
      segment.turnDirection = determineTurnDirection(prevBearing, segment.bearing);
      segment.turnAngle = segment.bearing - prevBearing;
    } else {
      segment.turnDirection = 'start';
    }
    
    turns.push(segment);
  }
  
  return turns;
}

// Generate navigation instructions from turns
function generateNavigationInstructions(turns) {
  const instructions = [];
  let cumulativeDistance = 0;
  
  turns.forEach((turn, index) => {
    const nextTurnDistance = cumulativeDistance;
    const distanceToNextTurn = index < turns.length - 1 
      ? turns[index + 1].distance 
      : 0;
    
    let instruction = '';
    
    if (turn.turnDirection === 'start') {
      instruction = `📍 Start and head towards your destination`;
    } else if (turn.turnDirection === 'straight') {
      instruction = `🛣️ Continue straight for ${turn.distance.toFixed(0)}m`;
    } else if (turn.turnDirection === 'left') {
      instruction = `↙️ Turn left after ${nextTurnDistance.toFixed(0)}m`;
    } else if (turn.turnDirection === 'right') {
      instruction = `↘️ Turn right after ${nextTurnDistance.toFixed(0)}m`;
    }
    
    if (index === turns.length - 1) {
      instruction = `🎯 You have arrived at your destination`;
    }
    
    instructions.push({
      instruction,
      distance: nextTurnDistance,
      direction: turn.turnDirection
    });
    
    cumulativeDistance += turn.distance;
  });
  
  return instructions;
}

// Update navigation display with current instruction
function updateNavigationDisplay(currentLocation, routeCoordinates) {
  if (routeCoordinates.length < 2) return;
  
  // Find closest point on route to user
  let closestIndex = 0;
  let minDistance = Infinity;
  
  routeCoordinates.forEach((coord, idx) => {
    const dist = calculateDistance(currentLocation, coord);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = idx;
    }
  });
  
  navigationState.currentSegmentIndex = closestIndex;
  
  // Calculate distance to next waypoint
  if (closestIndex < routeCoordinates.length - 1) {
    navigationState.nextTurnDistance = calculateDistance(
      currentLocation,
      routeCoordinates[closestIndex + 1]
    );
  } else {
    navigationState.nextTurnDistance = 0;
  }
  
  // Determine next turn direction
  if (closestIndex < routeCoordinates.length - 2) {
    const from = routeCoordinates[closestIndex];
    const to = routeCoordinates[closestIndex + 1];
    const next = routeCoordinates[closestIndex + 2];
    
    const bearing1 = calculateBearing(from, to);
    const bearing2 = calculateBearing(to, next);
    
    navigationState.nextTurnDirection = determineTurnDirection(bearing1, bearing2);
  } else {
    navigationState.nextTurnDirection = 'arrive';
  }
  
  // Update UI
  updateNavigationPanel();
}

// Update navigation panel with turn-by-turn info
function updateNavigationPanel() {
  const panelElement = document.getElementById('navigation-panel') || 
                       document.querySelector('.navigation-panel') ||
                       document.getElementById('directions-panel');
  
  if (!panelElement) return;
  
  const distMeters = navigationState.nextTurnDistance.toFixed(0);
  const distKm = (navigationState.nextTurnDistance / 1000).toFixed(1);
  
  let directionIcon = '🛣️';
  let turnText = 'Continue straight';
  
  if (navigationState.nextTurnDirection === 'left') {
    directionIcon = '↙️';
    turnText = 'Turn left';
  } else if (navigationState.nextTurnDirection === 'right') {
    directionIcon = '↘️';
    turnText = 'Turn right';
  } else if (navigationState.nextTurnDirection === 'arrive') {
    directionIcon = '🎯';
    turnText = 'You have arrived';
  }
  
  const html = `
    <div style="padding: 20px; background: linear-gradient(135deg, #0EA5A2 0%, #06B6D4 100%); color: white; border-radius: 8px; font-family: 'Poppins', sans-serif;">
      <div style="font-size: 48px; margin-bottom: 10px; text-align: center;">${directionIcon}</div>
      <h2 style="margin: 0 0 15px 0; font-size: 22px; text-align: center;">${turnText}</h2>
      <div style="font-size: 28px; font-weight: 700; text-align: center; margin-bottom: 10px;">
        ${distMeters}m
      </div>
      <p style="margin: 0; text-align: center; opacity: 0.9; font-size: 14px;">
        ${distKm}km to next turn
      </p>
      <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 4px;">
        <p style="margin: 0; font-size: 12px; opacity: 0.8;">
          📍 Current segment: ${navigationState.currentSegmentIndex + 1}
        </p>
      </div>
    </div>
  `;
  
  panelElement.innerHTML = html;
}

// Setup turn-by-turn navigation from route coordinates
function setupTurnByTurnNavigation(routeCoordinates) {
  navigationState.routeSegments = generateTurns(routeCoordinates);
  navigationState.instructions = generateNavigationInstructions(navigationState.routeSegments);
  
  console.log('📍 Turn-by-turn navigation setup');
  console.log('  Segments:', navigationState.routeSegments.length);
  console.log('  Instructions:', navigationState.instructions);
  
  // Display instructions list
  const instPanel = document.getElementById('instructions-list');
  if (instPanel) {
    let html = '<div style="font-size: 14px;">';
    navigationState.instructions.forEach((inst, idx) => {
      html += `<div style="padding: 8px; border-bottom: 1px solid #e0e0e0;">
        ${idx + 1}. ${inst.instruction}
      </div>`;
    });
    html += '</div>';
    instPanel.innerHTML = html;
  }
}

// ============================================
// 🤖 AI CHATBOT ASSISTANT FUNCTIONS
// ============================================

// Parse user message for location extraction
function extractLocations(message) {
  const locations = {
    type: null,
    value: null,
    confidence: 0
  };

  const message_lower = message.toLowerCase();

  // Check for destination keywords
  if (message_lower.includes('go to') || message_lower.includes('head to') || message_lower.includes('navigate to')) {
    locations.type = 'destination';
  } else if (message_lower.includes('from') || message_lower.includes('starting from') || message_lower.includes('my location')) {
    locations.type = 'origin';
  } else if (message_lower.includes('current location') || message_lower.includes('where am i')) {
    locations.type = 'query';
  }

  // Extract coordinate-like patterns
  const coordPattern = /\b(\d+\.\d+),\s*(\d+\.\d+)\b/;
  const coordMatch = message.match(coordPattern);
  
  if (coordMatch) {
    locations.value = [parseFloat(coordMatch[2]), parseFloat(coordMatch[1])]; // [lon, lat]
    locations.confidence = 0.95;
  } else {
    // Try to extract place names
    const placePatterns = [
      { name: 'Delhi', coords: [77.2095, 28.7041] },
      { name: 'Chandigarh', coords: [76.7794, 30.7333] },
      { name: 'Ghaziabad', coords: [77.4538, 28.6692] },
      { name: 'Noida', coords: [77.3910, 28.5921] },
      { name: 'Panipat', coords: [79.3910, 29.3910] }
    ];

    for (let place of placePatterns) {
      if (message_lower.includes(place.name.toLowerCase())) {
        locations.value = place.coords;
        locations.confidence = 0.85;
        break;
      }
    }
  }

  return locations;
}

// Process user message and generate AI response
function processUserMessage(userMessage) {
  // Add to conversation history
  aiAssistant.conversationHistory.push({
    role: 'user',
    message: userMessage,
    timestamp: new Date()
  });

  // Extract locations from message
  const locations = extractLocations(userMessage);
  const message_lower = userMessage.toLowerCase();
  let response = '';
  let action = null;

  // Route suggestion
  if (message_lower.includes('suggest') || message_lower.includes('best route') || message_lower.includes('route option')) {
    response = generateRoutesuggestion();
    action = 'showRoutes';
  }
  // Set destination
  else if (locations.type === 'destination' && locations.value) {
    aiAssistant.currentDestination = locations.value;
    response = `📍 Destination set to [${locations.value[0].toFixed(4)}, ${locations.value[1].toFixed(4)}]. Ready to navigate!`;
    action = 'setDestination';
  }
  // Set origin/current location
  else if (locations.type === 'origin' && locations.value) {
    aiAssistant.currentUserLocation = locations.value;
    response = `📌 Current location updated to [${locations.value[0].toFixed(4)}, ${locations.value[1].toFixed(4)}].`;
    action = 'setOrigin';
  }
  // Query current location
  else if (locations.type === 'query') {
    if (aiAssistant.currentUserLocation) {
      response = `📍 Your current location: [${aiAssistant.currentUserLocation[0].toFixed(4)}, ${aiAssistant.currentUserLocation[1].toFixed(4)}]`;
    } else {
      response = `📍 No current location set. Please share your current location to get started.`;
    }
    action = 'showLocation';
  }
  // Navigation help
  else if (message_lower.includes('help') || message_lower.includes('how') || message_lower.includes('what')) {
    response = generateHelpResponse();
    action = 'showHelp';
  }
  // Start navigation
  else if (message_lower.includes('navigate') || message_lower.includes('start') || message_lower.includes('go')) {
    if (aiAssistant.currentUserLocation && aiAssistant.currentDestination) {
      response = `🧭 Starting navigation from [${aiAssistant.currentUserLocation[0].toFixed(4)}, ${aiAssistant.currentUserLocation[1].toFixed(4)}] to [${aiAssistant.currentDestination[0].toFixed(4)}, ${aiAssistant.currentDestination[1].toFixed(4)}]. Generating sensory-friendly route...`;
      action = 'startNavigation';
    } else {
      response = `⚠️ Please set both your current location and destination first.`;
      action = 'missingInfo';
    }
  }
  // Default response
  else {
    response = generateSmartResponse(userMessage);
    action = 'general';
  }

  // Add assistant response to history
  aiAssistant.conversationHistory.push({
    role: 'assistant',
    message: response,
    action: action,
    timestamp: new Date()
  });

  return {
    response,
    action,
    currentLocation: aiAssistant.currentUserLocation,
    currentDestination: aiAssistant.currentDestination
  };
}

// Generate smart response based on user message
function generateSmartResponse(userMessage) {
  const responses = [
    `I understand you want help with navigation. I can help you find sensory-friendly routes! 🧭`,
    `That's a great question! I'm here to help you navigate comfortably. What would you like to know? 😊`,
    `Let me help! I can suggest routes, update your location, or answer navigation questions.`,
    `I'm here to assist! You can tell me your destination, and I'll find you a comfortable route. 🗺️`
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate route suggestion
function generateRoutesuggestion() {
  if (!aiAssistant.currentUserLocation || !aiAssistant.currentDestination) {
    return '⚠️ Please set your location and destination to get route suggestions.';
  }

  const distance = calculateDistance(aiAssistant.currentUserLocation, aiAssistant.currentDestination);
  const distanceKm = (distance / 1000).toFixed(1);
  const estimatedTime = Math.ceil(distance / 1000 / 5); // Assume 5 km/h for comfort

  return `🧭 Route Suggestions:\n\n` +
    `📍 Origin: [${aiAssistant.currentUserLocation[0].toFixed(4)}, ${aiAssistant.currentUserLocation[1].toFixed(4)}]\n` +
    `🎯 Destination: [${aiAssistant.currentDestination[0].toFixed(4)}, ${aiAssistant.currentDestination[1].toFixed(4)}]\n\n` +
    `📊 Route Details:\n` +
    `• Distance: ${distanceKm} km\n` +
    `• Est. Time: ${estimatedTime} minutes\n` +
    `• Type: Sensory-Friendly (avoiding noisy areas)\n` +
    `• Comfort Level: High ✅\n\n` +
    `Ready to navigate? Say "start navigation" or "begin".`;
}

// Generate help response
function generateHelpResponse() {
  return `🤖 Welcome to Rivo AI Navigation Assistant!\n\n` +
    `I can help you with:\n\n` +
    `📍 SET LOCATION:\n` +
    `• "My location is [coords or place name]"\n` +
    `• "I'm at Ghaziabad"\n\n` +
    `🎯 SET DESTINATION:\n` +
    `• "Take me to Delhi"\n` +
    `• "Navigate to Chandigarh"\n` +
    `• "Go to [77.2095, 28.7041]"\n\n` +
    `🧭 GET ROUTES:\n` +
    `• "Suggest routes"\n` +
    `• "Best route options"\n` +
    `• "Find sensory-friendly path"\n\n` +
    `▶️ START NAVIGATION:\n` +
    `• "Start navigation"\n` +
    `• "Begin journey"\n` +
    `• "Let's go"\n\n` +
    `📍 CURRENT STATUS:\n` +
    `• "Where am I?"\n` +
    `• "Show my location"\n\n` +
    `Try asking: "Take me to Delhi"`;
}

// Get AI response and execute action
function getAIResponse(userMessage) {
  const result = processUserMessage(userMessage);
  
  // Execute action if needed
  if (result.action === 'startNavigation' && result.currentLocation && result.currentDestination) {
    // Plan route with live tracking
    planComfortableRoute(result.currentLocation, result.currentDestination, true);
  }

  return result;
}

// Display chatbot message in UI
function displayChatMessage(role, message) {
  const chatBox = document.getElementById('chat-box') || document.querySelector('.chat-messages');
  if (!chatBox) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}`;
  messageDiv.style.cssText = `
    margin: 10px 0;
    padding: 12px 15px;
    border-radius: 8px;
    max-width: 80%;
    ${role === 'user' 
      ? 'background: #0EA5A2; color: white; margin-left: auto; text-align: right;' 
      : 'background: #f0f0f0; color: #333;'}
  `;
  messageDiv.textContent = message;
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Handle user input from chatbot interface
function handleChatInput(inputElement) {
  const message = inputElement.value.trim();
  if (!message) return;

  // Display user message
  displayChatMessage('user', message);
  inputElement.value = '';

  // Get AI response
  const result = getAIResponse(message);
  
  // Display AI response
  displayChatMessage('assistant', result.response);

  // Log for debugging
  console.log('💬 Chat Message:', {
    user: message,
    assistant: result.response,
    action: result.action,
    currentLocation: result.currentLocation,
    currentDestination: result.currentDestination
  });
}

// Generate comfort-aware route that avoids noisy zones
function generateComfortRoute(origin, dest) {
  const noisyZones = [
    [77.445, 28.655], [77.455, 28.665], [77.480, 28.645], [77.500, 28.635]
  ];

  // Add community-reported zones
  communityReports.noise.forEach(r => noisyZones.push(r.coords));
  communityReports.construction.forEach(r => noisyZones.push(r.coords));

  // Calculate waypoints that avoid noisy areas
  const midLat = (origin[1] + dest[1]) / 2;
  const midLon = (origin[0] + dest[0]) / 2;

  // Check if direct path passes through noisy zones
  let needsDetour = false;
  noisyZones.forEach(zone => {
    const distToZone = Math.hypot(midLon - zone[0], midLat - zone[1]);
    if (distToZone < 0.01) needsDetour = true;
  });

  if (needsDetour) {
    // Create detour through quieter areas
    const waypoint1 = [midLon - 0.01, midLat + 0.005];
    const waypoint2 = [midLon + 0.005, midLat - 0.01];
    return new atlas.data.LineString([origin, waypoint1, waypoint2, dest]);
  } else {
    // Direct route is safe
    return new atlas.data.LineString([origin, dest]);
  }
}

// Start live location tracking with dynamic route recalculation
function startLiveLocationTracking(destinationCoords) {
  if (!navigator.geolocation) {
    console.error('Geolocation not supported');
    return;
  }

  liveTracking.destination = destinationCoords;
  liveTracking.active = true;

  if (liveTracking.watchId) {
    navigator.geolocation.clearWatch(liveTracking.watchId);
  }

  console.log('🔴 Live location tracking started');

  liveTracking.watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      liveTracking.currentLocation = [longitude, latitude];

      // Update user location marker on map
      updateLiveLocationMarker([longitude, latitude], accuracy);

      // Check if distance threshold exceeded for recalculation
      const now = Date.now();
      const timeSinceLastCalc = now - liveTracking.lastRecalculatedAt;

      if (timeSinceLastCalc >= liveTracking.minRecalculationInterval) {
        // Recalculate route with new origin
        recalculateRouteFromLiveLocation([longitude, latitude], liveTracking.destination);
        liveTracking.lastRecalculatedAt = now;

        // Log movement details
        console.log(`📍 Location updated: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (±${accuracy.toFixed(0)}m)`);
      }
    },
    (error) => {
      console.error('❌ Geolocation error:', error.message);
      const errorMsg = error.code === error.PERMISSION_DENIED 
        ? 'Location permission denied' 
        : error.code === error.POSITION_UNAVAILABLE 
        ? 'Position unavailable' 
        : 'Location request timed out';
      alert(`Location Error: ${errorMsg}`);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// Stop live location tracking
function stopLiveLocationTracking() {
  if (liveTracking.watchId) {
    navigator.geolocation.clearWatch(liveTracking.watchId);
    liveTracking.watchId = null;
    liveTracking.active = false;
    console.log('⭕ Live location tracking stopped');
  }
}

// Update user location marker with accuracy indicator
function updateLiveLocationMarker(coords, accuracy) {
  if (!map || !datasource) return;

  // Remove old user location marker
  const existingFeatures = datasource.getShapes().filter(f => f.getProperties().isUserLocation);
  existingFeatures.forEach(f => datasource.remove(f));

  // Add new user location marker with accuracy circle
  const userMarker = new atlas.data.Feature(new atlas.data.Point(coords), {
    isUserLocation: true,
    accuracy: accuracy,
    name: 'Your Location'
  });

  datasource.add(userMarker);

  // Center map on user (optional - comment out if too distracting)
  // map.setCamera({ center: coords, zoom: 14 });
}

// Recalculate route from live location
function recalculateRouteFromLiveLocation(currentCoords, destinationCoords) {
  if (!map || !datasource || !liveTracking.destination) return;

  // Generate new comfort route from current location
  const newRoute = generateComfortRoute(currentCoords, destinationCoords);
  const routeCoordinates = newRoute.getCoordinates();

  // Remove old route from datasource
  const existingRoutes = datasource.getShapes().filter(f => f.getProperties() && f.getProperties().isRoute);
  existingRoutes.forEach(f => datasource.remove(f));

  // Add new route with property marker
  const routeFeature = new atlas.data.Feature(newRoute, { isRoute: true });
  datasource.add(routeFeature);

  console.log(`✅ Route recalculated from live location`);
  
  // Setup turn-by-turn navigation
  setupTurnByTurnNavigation(routeCoordinates);
  
  // Update navigation display with current location
  updateNavigationDisplay(currentCoords, routeCoordinates);
  
  // Update directions panel if it exists
  updateDirectionsPanel(currentCoords, destinationCoords, newRoute);
}

// Update directions panel with route info (optional)
function updateDirectionsPanel(origin, destination, routeFeature) {
  const panelElement = document.getElementById('directions-panel');
  if (!panelElement) return;

  // Calculate simple distance estimate (in degrees, approximate to km)
  const coords = routeFeature.getCoordinates();
  let totalDistance = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = coords[i + 1][0] - coords[i][0];
    const dy = coords[i + 1][1] - coords[i][1];
    totalDistance += Math.sqrt(dx * dx + dy * dy);
  }
  
  // Rough conversion: 1 degree ≈ 111 km at equator
  const distanceKm = (totalDistance * 111).toFixed(1);
  const estimatedTime = Math.ceil((totalDistance * 111) / 60); // assume 60 km/h avg

  panelElement.innerHTML = `
    <div style="padding: 15px; background: linear-gradient(135deg, #0EA5A2 0%, #06B6D4 100%); color: white; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">📍 Sensory-Friendly Route</h3>
      <p style="margin: 5px 0;"><strong>Distance:</strong> ${distanceKm} km</p>
      <p style="margin: 5px 0;"><strong>Est. Time:</strong> ${estimatedTime} min</p>
      <p style="margin: 5px 0; font-size: 12px; opacity: 0.9;">🟢 Route avoids noisy/crowded areas</p>
    </div>
  `;
}

// Expose live tracking functions globally
window.startLiveLocationTracking = startLiveLocationTracking;
window.stopLiveLocationTracking = stopLiveLocationTracking;
window.liveTracking = liveTracking;

// Expose navigation functions globally
window.navigationState = navigationState;
window.setupTurnByTurnNavigation = setupTurnByTurnNavigation;
window.updateNavigationDisplay = updateNavigationDisplay;
window.updateNavigationPanel = updateNavigationPanel;
window.calculateDistance = calculateDistance;
window.calculateBearing = calculateBearing;

// Expose AI chatbot functions globally
window.aiAssistant = aiAssistant;
window.processUserMessage = processUserMessage;
window.getAIResponse = getAIResponse;
window.displayChatMessage = displayChatMessage;
window.handleChatInput = handleChatInput;
window.extractLocations = extractLocations;

// Expose function globally for external access
window.planComfortableRoute = planComfortableRoute;
//FEDBACK
//header footer to every psage 


// Initialize map after SDK loads
if (window.atlas && document.getElementById('azureMap')) {
  initMap();
} else if (!document.getElementById('azureMap')) {
  console.log('Azure Maps not needed on this page');
} else {
  console.error('Azure Maps SDK not loaded.');
}

// Add event listener for index.html demo button only
document.addEventListener('DOMContentLoaded', () => {
  // Only run on index.html (check for Azure Maps element)
  if (document.getElementById('azureMap')) {
    const findRouteBtn = document.getElementById('findRouteBtn');
    const startTrackingBtn = document.getElementById('startTrackingBtn');
    const stopTrackingBtn = document.getElementById('stopTrackingBtn');

    if (findRouteBtn && window.planComfortableRoute) {
      findRouteBtn.addEventListener('click', () => {
        const originInput = document.getElementById('startInput');
        const destInput = document.getElementById('endInput');

        if (originInput && destInput) {
          const origin = [77.4538, 28.6692];
          const destination = [77.4316, 28.6384];
          // Enable live tracking on route planning
          window.planComfortableRoute(origin, destination, true);
        }
      });
    }

    // Live tracking controls
    if (startTrackingBtn) {
      startTrackingBtn.addEventListener('click', () => {
        const destination = liveTracking.destination || [77.4316, 28.6384];
        window.startLiveLocationTracking(destination);
        startTrackingBtn.disabled = true;
        if (stopTrackingBtn) stopTrackingBtn.disabled = false;
      });
    }

    if (stopTrackingBtn) {
      stopTrackingBtn.addEventListener('click', () => {
        window.stopLiveLocationTracking();
        stopTrackingBtn.disabled = true;
        if (startTrackingBtn) startTrackingBtn.disabled = false;
      });
    }
  }
  
  // Welcome popup handlers
  const welcomePopup = document.getElementById('welcomePopup');
  const welcomeCloseBtn = document.querySelector('.welcome-close');
  const welcomeGetStartedBtn = document.querySelector('.welcome-btn');
  
  if (welcomePopup && welcomeCloseBtn) {
    welcomeCloseBtn.addEventListener('click', () => {
      welcomePopup.style.display = 'none';
      localStorage.setItem('welcomeShown', 'true');
    });
  }
  
  if (welcomePopup && welcomeGetStartedBtn) {
    welcomeGetStartedBtn.addEventListener('click', () => {
      welcomePopup.style.display = 'none';
      localStorage.setItem('welcomeShown', 'true');
      // Scroll to features or demo section
      const featuresSection = document.getElementById('features');
      if (featuresSection) {
        featuresSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
  
  // Show welcome popup if not shown before
  if (welcomePopup && !localStorage.getItem('welcomeShown')) {
    welcomePopup.style.display = 'flex';
  }
});

// Geolocation and Redirection for index.html Demo
document.addEventListener('DOMContentLoaded', () => {
  const locateBtn = document.getElementById('locate-origin');
  const originInput = document.getElementById('origin');
  const destinationInput = document.getElementById('destination');
  const findRouteBtn = document.querySelector('.demo-btn');

  if (locateBtn && originInput) {
    locateBtn.addEventListener('click', () => {
      if (navigator.geolocation) {
        const originalPlaceholder = originInput.placeholder;
        originInput.value = '';
        originInput.placeholder = 'Locating...';

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            console.log(`Location precision: ${accuracy}m`);

            originInput.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            originInput.placeholder = originalPlaceholder;

            // Try reverse geocoding with Nominatim (OSM)
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
              .then(res => res.json())
              .then(data => {
                if (data.display_name) {
                  originInput.value = data.display_name;
                }
              })
              .catch(err => console.error('Reverse geocoding failed:', err));
          },
          (error) => {
            console.error('Geolocation error:', error);
            originInput.placeholder = originalPlaceholder;
            let errorMsg = 'Could not get your location.';
            if (error.code === error.TIMEOUT) errorMsg = 'Location request timed out. Please try again or enter manually.';
            alert(errorMsg);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } else {
        alert('Geolocation is not supported by your browser.');
      }
    });
  }

  if (findRouteBtn) {
    findRouteBtn.addEventListener('click', (e) => {
      // Use a more robust check: if these specific inputs exist, we are on the demo section
      const isDemoFormExist = originInput && destinationInput && findRouteBtn.closest('.demo-form');

      if (isDemoFormExist) {
        const start = originInput.value;
        const end = destinationInput.value;

        if (start || end) {
          const params = new URLSearchParams();
          if (start) params.append('start', start);
          if (end) params.append('end', end);

          // Use relative path for better compatibility with GitHub Pages/subfolders
          window.location.href = `rivo.html?${params.toString()}`;
        } else {
          window.location.href = 'rivo.html';
        }
      }
    });
  }
});



// Contact Form Handling (EmailJS)
document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.querySelector('#contact form');

  if (contactForm) {
    contactForm.addEventListener('submit', function (event) {
      event.preventDefault();

      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerText;

      // Set loading state
      submitBtn.innerText = 'Sending...';
      submitBtn.disabled = true;

      // Prepare params
      const serviceID = 'your service id'; // User to replace
      const templateID = 'your template id'; // User to replace

      // Send via EmailJS (sendForm automatically captures input values by name attribute)
      emailjs.sendForm(serviceID, templateID, this)
        .then(() => {
          alert('Message sent successfully!');
          this.reset();
        }, (err) => {
          // Show detailed error for debugging
          console.error('EmailJS Error:', err);
          alert(`Failed to send message.\n\nError: ${err.text || err.message || 'Unknown error'}\n\nPlease check:\n1. Service ID and Template ID are correct\n2. Email template has fields: name, email, message\n3. Service is connected and active`);
        })
        .finally(() => {
          submitBtn.innerText = originalText;
          submitBtn.disabled = false;
        });
    });
  }
});

// Global helper functions for onclick handlers and external access
window.goToReportZone = function(type) {
  if (!navigator.geolocation) {
    alert('❌ Location not supported by your browser');
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = [position.coords.longitude, position.coords.latitude];
      console.log('Report location:', coords);
      
      if (type === 'noise') {
        if (typeof reportNoiseZone === 'function') {
          reportNoiseZone(coords, 0.9, 'User reported noise');
          alert('✅ Thank you! Noise report submitted at your location.');
        }
      } else if (type === 'crowd') {
        if (typeof reportCrowdedArea === 'function') {
          reportCrowdedArea(coords, 0.8, 'User reported crowd');
          alert('✅ Thank you! Crowd report submitted at your location.');
        }
      }
    },
    (error) => {
      console.error('Location error:', error);
      if (error.code === 1) {
        alert('❌ Please allow location access in your browser settings');
      } else if (error.code === 2) {
        alert('❌ Location unavailable. Please try again.');
      } else {
        alert('❌ Location timeout. Please try again.');
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
};

window.checkComfort = function() {
  if (!navigator.geolocation) {
    if (typeof comfortAI !== 'undefined' && comfortAI.predict) {
      const comfort = comfortAI.predict([77.4538, 28.6692], Date.now());
      const percentage = (comfort * 100).toFixed(0);
      alert(`😊 Comfort Level: ${percentage}%`);
    } else {
      alert('❌ Comfort AI not available');
    }
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = [position.coords.longitude, position.coords.latitude];
      console.log('Checking comfort at:', coords);
      
      if (typeof comfortAI !== 'undefined' && comfortAI.predict) {
        const comfort = comfortAI.predict(coords, Date.now());
        const percentage = (comfort * 100).toFixed(0);
        let emoji = '😊';
        let message = 'Great!';
        if (comfort < 0.3) { emoji = '😰'; message = 'High stress'; }
        else if (comfort < 0.6) { emoji = '😐'; message = 'Moderate'; }
        alert(`${emoji} Comfort Level: ${percentage}%\n${message}`);
      } else {
        alert('❌ Comfort AI not available');
      }
    },
    (error) => {
      console.error('Location error:', error);
      if (typeof comfortAI !== 'undefined' && comfortAI.predict) {
        const comfort = comfortAI.predict([77.4538, 28.6692], Date.now());
        const percentage = (comfort * 100).toFixed(0);
        alert(`😊 Comfort Level: ${percentage}%\n(Using default location)`);
      } else {
        alert('❌ Comfort AI not available');
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
};

window.reportCurrentLocation = function(type) {
  if (!navigator.geolocation) {
    alert('❌ Location not supported by your browser');
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = [position.coords.longitude, position.coords.latitude];
      console.log('Location:', coords);
      
      if (type === 'noise') {
        if (typeof reportNoiseZone === 'function') {
          reportNoiseZone(coords, 0.9, 'User reported noise');
          alert('✅ Thank you! Noise report submitted at your location.');
        }
      } else if (type === 'crowd') {
        if (typeof reportCrowdedArea === 'function') {
          reportCrowdedArea(coords, 0.8, 'User reported crowd');
          alert('✅ Thank you! Crowd report submitted at your location.');
        }
      }
    },
    (error) => {
      console.error('Location error:', error);
      if (error.code === 1) {
        alert('❌ Please allow location access in your browser settings');
      } else if (error.code === 2) {
        alert('❌ Location unavailable. Please try again.');
      } else {
        alert('❌ Location timeout. Please try again.');
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
};