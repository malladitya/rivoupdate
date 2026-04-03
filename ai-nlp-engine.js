/**
 * AI-Powered Natural Language Processing Engine
 * Intelligent understanding of user commands and queries
 * @version 2.0
 */

class AIUnderstandingEngine {
  constructor() {
    this.conversationHistory = [];
    this.userPreferences = {
      origin: null,
      destination: null,
      preferenceType: 'comfort', // or 'speed'
      selectedModes: ['WALKING'],
      avoidAreas: []
    };
    
    // Confidence thresholds
    this.confidenceThreshold = 0.6;
    
    // Define AI intents (what the user wants to do)
    this.intents = {
      SET_LOCATION: { patterns: ['my location', 'im at', 'current location', 'where i am', 'at', 'position'], priority: 10 },
      SET_DESTINATION: { patterns: ['go to', 'navigate to', 'take me to', 'directions to', 'route to', 'heading to'], priority: 9 },
      GET_ROUTE: { patterns: ['route', 'directions', 'how do i get', 'way to', 'path to', 'show route'], priority: 8 },
      GET_COMFORT: { patterns: ['comfort level', 'sensory', 'how comfortable', 'stress level', 'noise', 'crowd'], priority: 7 },
      CHECK_TIME: { patterns: ['how long', 'time', 'duration', 'arrive', 'eta'], priority: 6 },
      HELP: { patterns: ['help', 'what can you do', 'commands', 'guide', 'how to'], priority: 5 },
      START_NAV: { patterns: ['start', 'begin', 'navigate', 'let\'s go', 'start navigation'], priority: 8 },
      AVOID_AREA: { patterns: ['avoid', 'skip', 'don\'t go', 'no', 'stay away'], priority: 7 },
      PREFERENCE: { patterns: ['prefer', 'comfortable', 'fast', 'quiet', 'peaceful'], priority: 6 },
      GREET: { patterns: ['hello', 'hi', 'hey', 'greetings'], priority: 1 }
    };

    // Major cities/locations database
    this.locationDatabase = {
      'delhi': { lat: 28.6139, lng: 77.2090, aliases: ['delhi', 'new delhi', 'dilli'] },
      'chandigarh': { lat: 30.7333, lng: 76.7794, aliases: ['chandigarh', 'mohali'] },
      'ghaziabad': { lat: 28.6692, lng: 77.4538, aliases: ['ghaziabad', 'gzb'] },
      'noida': { lat: 28.5355, lng: 77.3910, aliases: ['noida', 'ncr'] },
      'panipat': { lat: 29.3910, lng: 79.1580, aliases: ['panipat'] },
      'airport': { lat: 28.5562, lng: 77.1000, aliases: ['airport', 'indira gandhi', 'igia'] },
      'sector 7': { lat: 30.7389, lng: 76.7641, aliases: ['sector 7', 's7', 'sector7'] },
      'sector 17': { lat: 30.7428, lng: 76.7589, aliases: ['sector 17', 's17', 'sector17'] }
    };
  }

  /**
   * Main entry point: Process user message and return AI response
   */
  processUserMessage(userMessage) {
    // Store in history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    });

    // Clean input
    const cleanMessage = userMessage.toLowerCase().trim();

    // Step 1: Detect Intent
    const intent = this.detectIntent(cleanMessage);

    // Step 2: Extract Entities (locations, numbers, etc.)
    const entities = this.extractEntities(cleanMessage);

    // Step 3: Update user preferences with extracted data
    this.updatePreferences(entities);

    // Step 4: Generate response based on intent & entities
    const response = this.generateResponse(intent, entities, cleanMessage);

    // Store response in history
    this.conversationHistory.push({
      role: 'assistant',
      content: response.message,
      timestamp: Date.now(),
      intent: intent.name,
      confidence: intent.confidence
    });

    return response;
  }

  /**
   * Detect user intent using pattern matching and scoring
   */
  detectIntent(message) {
    let bestMatch = { name: 'UNKNOWN', confidence: 0, priority: 0 };

    for (const [intentName, intentData] of Object.entries(this.intents)) {
      for (const pattern of intentData.patterns) {
        // Calculate confidence based on pattern match
        const regex = new RegExp(`\\b${pattern}\\b`);
        if (regex.test(message)) {
          const confidence = this.calculateConfidence(message, pattern);
          if (confidence > bestMatch.confidence) {
            bestMatch = { 
              name: intentName, 
              confidence: confidence,
              priority: intentData.priority,
              pattern: pattern
            };
          }
        }
      }
    }

    return bestMatch.confidence > this.confidenceThreshold 
      ? bestMatch 
      : { name: 'UNKNOWN', confidence: 0, priority: 0 };
  }

  /**
   * Extract entities from user message
   */
  extractEntities(message) {
    const entities = {
      locations: [],
      coordinates: [],
      numbers: [],
      modes: [],
      preferences: [],
      keywords: []
    };

    // Extract coordinates (lat, lng format)
    const coordRegex = /(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g;
    let match;
    while ((match = coordRegex.exec(message)) !== null) {
      entities.coordinates.push({
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2]),
        text: match[0]
      });
    }

    // Extract location names
    for (const [locKey, locData] of Object.entries(this.locationDatabase)) {
      for (const alias of locData.aliases) {
        if (message.includes(alias)) {
          entities.locations.push({
            name: locKey,
            lat: locData.lat,
            lng: locData.lng,
            confidence: this.calculateLocationConfidence(message, alias)
          });
        }
      }
    }

    // Extract numbers (distances, etc.)
    const numberRegex = /\d+(\.\d+)?/g;
    while ((match = numberRegex.exec(message)) !== null) {
      entities.numbers.push(parseFloat(match[0]));
    }

    // Extract transport modes
    const modes = ['walking', 'transit', 'driving', 'cycling'];
    modes.forEach(mode => {
      if (message.includes(mode)) {
        entities.modes.push(mode.toUpperCase());
      }
    });

    // Extract preferences
    const prefPatterns = {
      'comfort': ['comfortable', 'calm', 'quiet', 'peaceful', 'sensory', 'easy'],
      'speed': ['fast', 'quick', 'shortest', 'quickest'],
      'safety': ['safe', 'secure', 'well-lit'],
      'scenic': ['beautiful', 'scenic', 'scenic route']
    };

    for (const [pref, keywords] of Object.entries(prefPatterns)) {
      keywords.forEach(keyword => {
        if (message.includes(keyword)) {
          entities.preferences.push(pref);
        }
      });
    }

    // Extract general keywords
    const keywords = message.match(/\b[a-z]{4,}\b/g) || [];
    entities.keywords = [...new Set(keywords)];

    return entities;
  }

  /**
   * Update user preferences based on extracted entities
   */
  updatePreferences(entities) {
    // Update origin/destination based on extracted locations
    if (entities.locations.length > 0) {
      const location = entities.locations[0];
      if (!this.userPreferences.origin) {
        this.userPreferences.origin = location;
      } else {
        this.userPreferences.destination = location;
      }
    }

    // Update coordinate-based locations
    if (entities.coordinates.length > 0 && !this.userPreferences.origin) {
      this.userPreferences.origin = {
        lat: entities.coordinates[0].lat,
        lng: entities.coordinates[0].lng
      };
    }

    // Update transport modes
    if (entities.modes.length > 0) {
      this.userPreferences.selectedModes = entities.modes;
    }

    // Update preference type
    if (entities.preferences.includes('comfort')) {
      this.userPreferences.preferenceType = 'comfort';
    } else if (entities.preferences.includes('speed')) {
      this.userPreferences.preferenceType = 'speed';
    }
  }

  /**
   * Generate intelligent response based on intent & entities
   */
  generateResponse(intent, entities, originalMessage) {
    const intentName = intent.name;
    
    let message = '';
    let action = null;
    let data = {};

    switch (intentName) {
      case 'SET_LOCATION':
        if (entities.coordinates.length > 0) {
          this.userPreferences.origin = {
            lat: entities.coordinates[0].lat,
            lng: entities.coordinates[0].lng
          };
          message = `✅ Got your location: ${entities.coordinates[0].lat.toFixed(4)}, ${entities.coordinates[0].lng.toFixed(4)}`;
          action = 'SET_ORIGIN';
          data = { location: this.userPreferences.origin };
        } else if (entities.locations.length > 0) {
          this.userPreferences.origin = entities.locations[0];
          message = `✅ Set origin to ${entities.locations[0].name.toUpperCase()}`;
          action = 'SET_ORIGIN';
          data = { location: this.userPreferences.origin };
        } else {
          message = '📍 Please provide your location (e.g., "28.6692, 77.4538" or "Ghaziabad")';
        }
        break;

      case 'SET_DESTINATION':
        if (entities.coordinates.length > 0) {
          this.userPreferences.destination = {
            lat: entities.coordinates[0].lat,
            lng: entities.coordinates[0].lng
          };
          message = `✅ Destination set: ${entities.coordinates[0].lat.toFixed(4)}, ${entities.coordinates[0].lng.toFixed(4)}`;
          action = 'SET_DESTINATION';
          data = { location: this.userPreferences.destination };
        } else if (entities.locations.length > 0) {
          this.userPreferences.destination = entities.locations[0];
          message = `✅ Navigating to ${entities.locations[0].name.toUpperCase()}`;
          action = 'SET_DESTINATION';
          data = { location: this.userPreferences.destination };
        } else {
          message = '🗺️ Where do you want to go? (e.g., "Airport", "Sector 17", or coordinates)';
        }
        break;

      case 'GET_ROUTE':
        if (this.userPreferences.origin && this.userPreferences.destination) {
          message = `🛣️ Computing ${this.userPreferences.preferenceType} route from ${this.userPreferences.origin.name || 'your location'} to ${this.userPreferences.destination.name || 'destination'}...`;
          action = 'CALCULATE_ROUTE';
          data = {
            origin: this.userPreferences.origin,
            destination: this.userPreferences.destination,
            preference: this.userPreferences.preferenceType,
            modes: this.userPreferences.selectedModes
          };
        } else {
          message = '📍 Please set both origin and destination first. Say "I am at [location]" and "Take me to [destination]"';
        }
        break;

      case 'GET_COMFORT':
        const comfortLevel = Math.floor(Math.random() * 40) + 60; // Simulated comfort
        const emoji = comfortLevel > 70 ? '😊' : comfortLevel > 50 ? '😐' : '😰';
        message = `${emoji} Comfort Level: ${comfortLevel}% (${comfortLevel > 70 ? 'Great' : comfortLevel > 50 ? 'Moderate' : 'Low comfort'})`;
        action = 'CHECK_COMFORT';
        data = { comfort: comfortLevel };
        break;

      case 'START_NAV':
        if (this.userPreferences.destination) {
          message = `🚀 Starting navigation to ${this.userPreferences.destination.name || 'destination'}! Follow the route...`;
          action = 'START_NAVIGATION';
          data = { destination: this.userPreferences.destination };
        } else {
          message = '🗺️ Set a destination first!';
        }
        break;

      case 'HELP':
        message = `📚 I can help with:
• "Take me to [place]" - Navigation
• "My location is [place]" - Set current location
• "Show me route" - Get directions
• "Comfort level" - Check sensory comfort
• "Avoid [area]" - Skip certain areas
• "Start navigation" - Begin guided tour`;
        action = 'SHOW_HELP';
        break;

      case 'GREET':
        message = `👋 Hello! I'm Harbor, your AI navigation assistant. I can help you find sensory-friendly routes. Try "Help" to see what I can do!`;
        break;

      case 'AVOID_AREA':
        if (entities.locations.length > 0) {
          this.userPreferences.avoidAreas.push(entities.locations[0]);
          message = `✅ Added ${entities.locations[0].name} to your avoid list`;
          action = 'ADD_AVOID_AREA';
          data = { area: entities.locations[0] };
        } else {
          message = '🚫 Which area do you want to avoid?';
        }
        break;

      case 'PREFERENCE':
        if (entities.preferences.length > 0) {
          message = `✅ Set preference to ${entities.preferences[0].toUpperCase()}`;
          action = 'SET_PREFERENCE';
          data = { preference: entities.preferences[0] };
        }
        break;

      default:
        message = this.generateContextualResponse(originalMessage, entities);
        action = 'ANSWER';
    }

    return {
      message: message,
      action: action,
      data: data,
      intent: intent.name,
      confidence: intent.confidence,
      preferences: this.userPreferences,
      conversationContext: this.getConversationContext()
    };
  }

  /**
   * Generate smart suggestions based on message content
   */
  generateSmartSuggestion(message) {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('where')) return 'Try saying "Take me to [place]"';
    if (lowerMsg.includes('how')) return 'I can calculate routes and show you directions!';
    if (lowerMsg.includes('can') || lowerMsg.includes('do')) return 'Type "Help" to see all my capabilities';
    return 'Type "Help" if you need guidance!';
  }

  /**
   * Generate contextual and intelligent responses to user questions
   */
  generateContextualResponse(message, entities) {
    const lowerMsg = message.toLowerCase();
    
    // Contextual Q&A based on keywords
    if (lowerMsg.includes('what') || lowerMsg.includes('who')) {
      if (lowerMsg.includes('rivo') || lowerMsg.includes('app')) {
        return '🏃 Rivo is a navigation app designed for people with autism and sensory sensitivities. It helps you find quiet, comfortable routes and avoid noisy or crowded areas.';
      }
      if (lowerMsg.includes('sensory') || lowerMsg.includes('autism')) {
        return '🧠 Sensory-friendly routes consider factors like noise levels, crowd density, and visual stress. I help identify the most comfortable paths for your journey.';
      }
      if (lowerMsg.includes('route') || lowerMsg.includes('navigation')) {
        return '🗺️ I calculate routes based on your preferences. You can choose between comfort and speed. Set your location and destination to get started!';
      }
      if (lowerMsg.includes('quiet') || lowerMsg.includes('calm')) {
        return '🧘 I find peaceful routes that avoid noisy areas, busy streets, and crowded zones. This is perfect if you have sensory sensitivities.';
      }
    }
    
    if (lowerMsg.includes('how') || lowerMsg.includes('help')) {
      if (lowerMsg.includes('work') || lowerMsg.includes('use')) {
        return '📖 Start by saying "My location is [place]" then "Take me to [destination]". I will find the best sensory-friendly route for you!';
      }
      if (lowerMsg.includes('avoid') || lowerMsg.includes('noise') || lowerMsg.includes('crowd')) {
        return '🚫 Say "Avoid [area]" and I will keep that location off your routes. I also analyze community reports about noisy or crowded zones.';
      }
      if (lowerMsg.includes('community') || lowerMsg.includes('report')) {
        return '👥 Community reports help make routes better. Users share information about noisy areas, construction, or crowds. This helps all Rivo users!';
      }
    }
    
    if (lowerMsg.includes('can') || lowerMsg.includes('do')) {
      return '✨ I can:\n• Find quiet, sensory-friendly routes\n• Calculate travel time\n• Show step-by-step directions\n• Help you avoid noisy areas\n• Provide comfort ratings\n\nTry "Help" for specific commands!';
    }
    
    if (lowerMsg.includes('comfort')) {
      return '😊 Comfort rating shows how sensory-friendly a route is. Higher comfort = fewer noisy areas, less crowding, and more green spaces. Lower comfort = busier, louder areas.';
    }
    
    if (lowerMsg.includes('direction') || lowerMsg.includes('turn')) {
      return '🛣️ Give me a destination! Say "Take me to [place]" and I will provide turn-by-turn directions. You can also ask for comfort level details along the way.';
    }
    
    if (lowerMsg.includes('autis') || lowerMsg.includes('sensory') || lowerMsg.includes('neurodivers')) {
      return '🤝 Rivo is specifically designed for neurodivergent individuals, especially those with autism. It acknowledges sensory sensitivities and helps find comfortable environments.';
    }
    
    // Default helpful response
    return `💬 That's a great question! I'm here to help with navigation and finding sensory-friendly routes. Try "Help" to see my commands, or tell me where you want to go!`;
  }

  /**
   * Calculate confidence score for intent matching
   */
  calculateConfidence(message, pattern) {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence if exact pattern found
    if (message.includes(pattern)) {
      confidence += 0.3;
    }
    
    // Higher confidence if pattern appears at start
    if (message.startsWith(pattern)) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate location confidence
   */
  calculateLocationConfidence(message, alias) {
    // Higher confidence if location name is exact match
    if (message.includes(alias)) {
      return 0.9;
    }
    return 0.7;
  }

  /**
   * Get conversation context for maintaining coherence
   */
  getConversationContext() {
    const recent = this.conversationHistory.slice(-4); // Last 4 messages
    return {
      totalMessages: this.conversationHistory.length,
      recentContext: recent,
      currentState: {
        hasOrigin: !!this.userPreferences.origin,
        hasDestination: !!this.userPreferences.destination,
        preferenceType: this.userPreferences.preferenceType
      }
    };
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Get user conversation summary
   */
  getConversationSummary() {
    return {
      origin: this.userPreferences.origin,
      destination: this.userPreferences.destination,
      preference: this.userPreferences.preferenceType,
      modes: this.userPreferences.selectedModes,
      avoidAreas: this.userPreferences.avoidAreas,
      totalInteractions: this.conversationHistory.length
    };
  }
}

// Export for use in browser
window.AIUnderstandingEngine = AIUnderstandingEngine;
