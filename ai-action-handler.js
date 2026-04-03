/**
 * AI Action Handler - Processes AI-generated actions and updates the map/app
 * Integrates AI Understanding output with the rest of the application
 */

window.handleAIAction = function(aiResponse) {
  const { action, data, preferences } = aiResponse;
  
  console.log('Handling AI Action:', action, data);
  
  switch (action) {
    case 'SET_ORIGIN':
      if (data.location) {
        handleSetOrigin(data.location);
      }
      break;
      
    case 'SET_DESTINATION':
      if (data.location) {
        handleSetDestination(data.location);
      }
      break;
      
    case 'CALCULATE_ROUTE':
      if (data.origin && data.destination) {
        handleCalculateRoute(data);
      }
      break;
      
    case 'START_NAVIGATION':
      if (data.destination) {
        handleStartNavigation(data.destination);
      }
      break;
      
    case 'CHECK_COMFORT':
      handleCheckComfort(data);
      break;
      
    case 'ADD_AVOID_AREA':
      if (data.area) {
        handleAvoidArea(data.area);
      }
      break;
      
    case 'SET_PREFERENCE':
      handleSetPreference(data.preference);
      break;
      
    case 'SHOW_HELP':
      // Help message is already displayed
      break;
      
    default:
      console.log('Unknown action:', action);
  }
  
  // Update global state if available
  if (window.aiState) {
    window.aiState = {
      ...window.aiState,
      lastResponse: aiResponse,
      userPreferences: preferences
    };
  } else {
    window.aiState = {
      lastResponse: aiResponse,
      userPreferences: preferences
    };
  }
};

/**
 * Set origin location on the map
 */
function handleSetOrigin(location) {
  console.log('Setting origin:', location);
  
  // Store in window for access by map script
  if (!window.navigationState) window.navigationState = {};
  window.navigationState.origin = location;
  
  // Get coordinates
  const lat = location.lat || location[1];
  const lng = location.lng || location[0];
  
  // Add marker to map via global planComfortableRoute or direct map access
  if (typeof window.map !== 'undefined' && window.map && typeof window.datasource !== 'undefined') {
    const originFeature = new atlas.data.Feature(new atlas.data.Point([lng, lat]), { 
      name: 'Origin', 
      isOrigin: true 
    });
    window.datasource.add(originFeature);
    console.log('✅ Origin marker added to map at:', lat, lng);
  }
  
  // Log for debugging
  console.log('✅ Origin set:', location);
}

/**
 * Set destination location on the map
 */
function handleSetDestination(location) {
  console.log('Setting destination:', location);
  
  if (!window.navigationState) window.navigationState = {};
  window.navigationState.destination = location;
  
  // Get coordinates
  const lat = location.lat || location[1];
  const lng = location.lng || location[0];
  
  // Add destination marker to map
  if (typeof window.map !== 'undefined' && window.map && typeof window.datasource !== 'undefined') {
    const destFeature = new atlas.data.Feature(new atlas.data.Point([lng, lat]), { 
      name: 'Destination', 
      isDestination: true 
    });
    window.datasource.add(destFeature);
    console.log('✅ Destination marker added to map at:', lat, lng);
  }
  
  console.log('✅ Destination set:', location);
}

/**
 * Calculate and display route
 */
function handleCalculateRoute(data) {
  console.log('Calculating route:', data);
  
  const { origin, destination, preference, modes } = data;
  
  if (!window.navigationState) window.navigationState = {};
  window.navigationState.routePreference = preference;
  window.navigationState.modes = modes;
  
  // Get coordinates
  const originCoords = [origin.lng || origin[0], origin.lat || origin[1]];
  const destCoords = [destination.lng || destination[0], destination.lat || destination[1]];
  
  console.log('Route from:', originCoords, 'to:', destCoords);
  
  // Trigger route calculation via the global planComfortableRoute function
  if (typeof window.planComfortableRoute === 'function') {
    window.planComfortableRoute(originCoords, destCoords, false);
    console.log(`🛣️ Route displayed on map (${preference} preference)`);
  } else if (typeof window.map !== 'undefined' && window.map && typeof window.datasource !== 'undefined') {
    // Fallback: manually draw the route
    const routeCoords = [originCoords, destCoords]; // Simple direct route
    const routeLineString = new atlas.data.LineString(routeCoords);
    const routeFeature = new atlas.data.Feature(routeLineString, { isRoute: true });
    window.datasource.add(routeFeature);
    
    // Center map on route
    if (typeof atlas !== 'undefined' && atlas.data && atlas.data.BoundingBox) {
      const bounds = atlas.data.BoundingBox.fromData([
        new atlas.data.Point(originCoords),
        new atlas.data.Point(destCoords)
      ]);
      window.map.setCamera({ bounds: bounds, padding: 50 });
    }
    
    console.log(`🛣️ Route drawn directly on map`);
  }
}


/**
 * Start turn-by-turn navigation
 */
function handleStartNavigation(destination) {
  console.log('Starting navigation:', destination);
  
  if (!window.navigationState) window.navigationState = {};
  window.navigationState.isNavigating = true;
  
  // Get current location
  const origin = window.navigationState.origin || window.navigationState.currentLocation;
  
  if (!origin) {
    console.error('Origin not set - cannot start navigation');
    return;
  }
  
  const originCoords = [origin.lng || origin[0], origin.lat || origin[1]];
  const destCoords = [destination.lng || destination[0], destination.lat || destination[1]];
  
  // Trigger navigation with live tracking
  if (typeof window.planComfortableRoute === 'function') {
    window.planComfortableRoute(originCoords, destCoords, true); // true = enable live tracking
    console.log('🚀 Navigation started with live tracking');
  }
}

/**
 * Check comfort level at current location
 */
function handleCheckComfort(data) {
  console.log('Checking comfort level:', data);
  
  // Trigger comfort check if function exists
  if (typeof checkComfortLevel === 'function') {
    checkComfortLevel();
  }
}

/**
 * Add area to avoid list
 */
function handleAvoidArea(area) {
  console.log('Adding area to avoid:', area);
  
  if (!window.navigationState) window.navigationState = {};
  if (!window.navigationState.avoidAreas) window.navigationState.avoidAreas = [];
  
  window.navigationState.avoidAreas.push(area);
  
  // Update map if function exists
  if (typeof updateAvoidAreas === 'function') {
    updateAvoidAreas(window.navigationState.avoidAreas);
  }
  
  console.log('🚫 Area added to avoid list');
}

/**
 * Set user preference (comfort/speed)
 */
function handleSetPreference(preference) {
  console.log('Setting preference:', preference);
  
  if (!window.navigationState) window.navigationState = {};
  window.navigationState.preference = preference;
  
  console.log(`⚙️ Preference set to: ${preference}`);
}

/**
 * Get AI engine instance
 */
window.getAIEngine = function() {
  if (typeof AIUnderstandingEngine !== 'undefined') {
    // Create or return existing instance
    if (!window.aiEngineInstance) {
      window.aiEngineInstance = new AIUnderstandingEngine();
    }
    return window.aiEngineInstance;
  }
  return null;
};

/**
 * Get conversation summary
 */
window.getConversationSummary = function() {
  const engine = window.getAIEngine();
  if (engine) {
    return engine.getConversationSummary();
  }
  return null;
};

/**
 * Clear AI conversation history
 */
window.clearConversationHistory = function() {
  const engine = window.getAIEngine();
  if (engine) {
    engine.clearHistory();
    console.log('Conversation history cleared');
  }
};

/**
 * Get current navigation state
 */
window.getNavigationState = function() {
  return window.navigationState || {};
};

/**
 * Set navigation state programmatically
 */
window.setNavigationState = function(state) {
  window.navigationState = { ...window.navigationState, ...state };
  console.log('Navigation state updated:', window.navigationState);
};

// Log when loaded
console.log('✅ AI Action Handler loaded - AI-Powered Understanding is ACTIVE');

// Initialize AI-Map Integration
document.addEventListener('DOMContentLoaded', function() {
  // Wait for map to be ready
  const checkMapReady = setInterval(function() {
    if (typeof window.map !== 'undefined' && window.map && typeof window.datasource !== 'undefined') {
      clearInterval(checkMapReady);
      console.log('✅ Map detected - AI integration ready for route display');
      window.aiMapReady = true;
    }
  }, 500);
  
  // Timeout after 10 seconds
  setTimeout(() => {
    if (checkMapReady) clearInterval(checkMapReady);
  }, 10000);
});
