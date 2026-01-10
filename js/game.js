/**
 * Main game controller
 * Handles game loop, rendering, and event orchestration
 */

import { NPC, NPC_PERSONALITIES } from './npc.js';
import { EventGenerator, EVENT_TYPES } from './events.js';
import { GameAI } from './gameAI.js';
import { chatState } from './chat.js';
import { cacheDB } from './cache.js';

class Game {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.lastFrameTime = 0;
    this.targetFPS = 60;
    this.frameInterval = 1000 / this.targetFPS;

    // Game state
    this.npcs = [];
    this.eventQueue = [];
    this.isPaused = false;
    this.isModelLoaded = false;

    // Systems
    this.gameAI = new GameAI();
    this.eventGenerator = null;

    // DOM elements
    this.elements = {
      loading: null,
      container: null,
      progress: null,
      status: null,
      pauseBtn: null,
      resetBtn: null,
      eventLog: null,
    };

    // Event log
    this.eventLogEntries = [];
    this.maxLogEntries = 20;
  }

  /**
   * Initialize game
   */
  async init() {
    // Get DOM elements
    this.elements.loading = document.getElementById('game-loading');
    this.elements.container = document.getElementById('game-container');
    this.elements.progress = document.getElementById('game-progress');
    this.elements.status = document.getElementById('game-status');
    this.elements.pauseBtn = document.getElementById('pause-btn');
    this.elements.resetBtn = document.getElementById('reset-btn');
    this.elements.eventLog = document.getElementById('event-log-content');

    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Setup event listeners
    this.setupEventListeners();

    // Check WebGPU support
    if (!this.gameAI.checkWebGPU()) {
      this.elements.status.textContent = 'WebGPU not supported. Use Chrome 113+, Edge 113+ or Firefox Nightly.';
      return;
    }

    // Load model
    await this.loadModel();

    // Initialize game world
    this.initializeWorld();

    // Show game
    this.elements.loading.style.display = 'none';
    this.elements.container.classList.remove('hidden');

    // Start game loop
    this.isModelLoaded = true;
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  /**
   * Load AI model
   */
  async loadModel() {
    try {
      this.elements.status.textContent = 'Loading AI model...';

      const progressCallback = (info) => {
        if (info.status === 'progress') {
          const percentage = Math.round((info.loaded / info.total) * 100);
          this.elements.progress.value = percentage;
          this.elements.status.textContent = `Downloading: ${percentage}%`;
        }
      };

      await this.gameAI.initialize(progressCallback);

      this.elements.status.textContent = 'Model loaded! Initializing world...';
    } catch (error) {
      console.error('Error loading model:', error);
      this.elements.status.textContent = `Error: ${error.message}`;
      throw error;
    }
  }

  /**
   * Initialize game world
   */
  initializeWorld() {
    // Create NPCs
    this.npcs = [
      new NPC(NPC_PERSONALITIES.knight),
      new NPC(NPC_PERSONALITIES.wizard),
      new NPC(NPC_PERSONALITIES.rogue),
    ];

    // Set world bounds for all NPCs
    this.npcs.forEach((npc) => {
      npc.setWorldBounds(this.canvas.width, this.canvas.height);
    });

    // Create event generator
    this.eventGenerator = new EventGenerator(this);

    // Add initial world event
    this.addEventLogEntry('Game Started', 'Welcome to Fantasy RPG - Watch Mode!');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.elements.pauseBtn.addEventListener('click', () => this.togglePause());
    this.elements.resetBtn.addEventListener('click', () => this.reset());
  }

  /**
   * Toggle pause state
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    this.elements.pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
  }

  /**
   * Reset game
   */
  reset() {
    // Clear event queue
    this.eventQueue = [];

    // Reset NPCs
    this.npcs.forEach((npc, index) => {
      const personality = Object.values(NPC_PERSONALITIES)[index];
      npc.x = personality.startX;
      npc.y = personality.startY;
      npc.targetX = null;
      npc.targetY = null;
      npc.conversationHistory = [];
      npc.currentDialogue = null;
      npc.dialogueTimer = 0;
      npc.currentActivity = 'idle';
      npc.lastInteractionTime = 0;
    });

    // Clear event log
    this.eventLogEntries = [];
    this.elements.eventLog.innerHTML = '';
    this.addEventLogEntry('Game Reset', 'World has been reset');

    // Reset event generator
    this.eventGenerator.lastWorldEventTime = 0;
  }

  /**
   * Main game loop
   */
  gameLoop(currentTime) {
    const deltaTime = currentTime - this.lastFrameTime;

    if (deltaTime >= this.frameInterval) {
      this.update(deltaTime);
      this.render();
      this.lastFrameTime = currentTime;
    }

    requestAnimationFrame((time) => this.gameLoop(time));
  }

  /**
   * Update game state
   */
  update(deltaTime) {
    if (!this.isModelLoaded || this.isPaused) return;

    // 1. Update NPC positions
    this.updateNPCPositions(deltaTime);

    // 2. Check for event triggers
    this.checkEventTriggers();

    // 3. Process event queue
    this.processEventQueue();

    // 4. Update dialogue timers
    this.updateDialogue(deltaTime);
  }

  /**
   * Update NPC positions
   */
  updateNPCPositions(deltaTime) {
    this.npcs.forEach((npc) => npc.updateMovement(deltaTime));
  }

  /**
   * Update dialogue timers
   */
  updateDialogue(deltaTime) {
    this.npcs.forEach((npc) => npc.updateDialogue(deltaTime));
  }

  /**
   * Check event triggers
   */
  checkEventTriggers() {
    const allEvents = [];

    // Proximity events
    const proximityEvents = this.eventGenerator.checkProximityEvents(this.npcs);
    allEvents.push(...proximityEvents);

    // Discovery events
    const discoveryEvents = this.eventGenerator.checkDiscoveryEvents(this.npcs);
    allEvents.push(...discoveryEvents);

    // World events
    const worldEvents = this.eventGenerator.checkWorldEvents();
    allEvents.push(...worldEvents);

    // Observation events
    const observationEvents = this.eventGenerator.checkObservationEvents(this.npcs);
    allEvents.push(...observationEvents);

    // Add to queue (avoid duplicates)
    allEvents.forEach((event) => {
      const isDuplicate = this.eventQueue.some(
        (queuedEvent) =>
          queuedEvent.type === event.type &&
          queuedEvent.participants.every((p, i) => p.id === event.participants[i]?.id)
      );

      if (!isDuplicate) {
        this.eventQueue.push(event);
      }
    });

    // Limit queue size
    if (this.eventQueue.length > 10) {
      this.eventQueue = this.eventQueue.slice(-10);
    }
  }

  /**
   * Process event queue
   */
  processEventQueue() {
    if (this.eventQueue.length === 0 || chatState.isGenerating) {
      return;
    }

    // Get next event
    const event = this.eventQueue.shift();

    // Process based on event type
    switch (event.type) {
      case EVENT_TYPES.ENCOUNTER:
        this.handleEncounter(event);
        break;
      case EVENT_TYPES.DISCOVERY:
        this.handleDiscovery(event);
        break;
      case EVENT_TYPES.WORLD_EVENT:
        this.handleWorldEvent(event);
        break;
      case EVENT_TYPES.OBSERVATION:
        this.handleObservation(event);
        break;
      case EVENT_TYPES.RESPONSE:
        this.handleResponse(event);
        break;
    }
  }

  /**
   * Handle encounter event
   */
  async handleEncounter(event) {
    const [npc1, npc2] = event.participants;

    this.addEventLogEntry('Encounter', `${npc1.name} meets ${npc2.name}`, 'encounter');

    // NPC1 initiates conversation
    try {
      await this.gameAI.generateNPCResponse(npc1, `You encounter ${npc2.name}. Greet them and comment on meeting them here.`);

      // Queue NPC2's response
      this.eventQueue.push({
        type: EVENT_TYPES.RESPONSE,
        participants: [npc2, npc1],
        context: `Respond to ${npc1.name} who said: "${npc1.currentDialogue}"`,
        timestamp: Date.now(),
      });

      // Update interaction times
      npc1.lastInteractionTime = Date.now();
      npc2.lastInteractionTime = Date.now();
    } catch (error) {
      console.error('Error generating encounter response:', error);
    }
  }

  /**
   * Handle discovery event
   */
  async handleDiscovery(event) {
    const [npc] = event.participants;

    this.addEventLogEntry('Discovery', `${npc.name} discovers ${event.discovery}`, 'discovery');

    try {
      await this.gameAI.generateNPCResponse(npc, `You discover ${event.discovery}. What is your reaction?`);
    } catch (error) {
      console.error('Error generating discovery response:', error);
    }
  }

  /**
   * Handle world event
   */
  async handleWorldEvent(event) {
    this.addEventLogEntry('World Event', event.context, 'world-event');

    // Pick a random NPC to react
    const npc = event.participants[Math.floor(Math.random() * event.participants.length)];

    try {
      await this.gameAI.generateNPCResponse(npc, `${event.context}. What do you observe or think about this?`);
    } catch (error) {
      console.error('Error generating world event response:', error);
    }
  }

  /**
   * Handle observation event
   */
  async handleObservation(event) {
    const [npc] = event.participants;

    this.addEventLogEntry('Observation', event.context, 'observation');

    try {
      await this.gameAI.generateNPCResponse(npc, `You pause to observe your surroundings. What do you notice or think about?`);
    } catch (error) {
      console.error('Error generating observation response:', error);
    }
  }

  /**
   * Handle response event (NPC responding to another)
   */
  async handleResponse(event) {
    const [npc, otherNpc] = event.participants;

    try {
      await this.gameAI.generateNPCResponse(npc, event.context);
    } catch (error) {
      console.error('Error generating response:', error);
    }
  }

  /**
   * Add entry to event log
   */
  addEventLogEntry(type, text, cssClass = '') {
    this.eventLogEntries.push({ type, text, cssClass });

    // Limit log entries
    if (this.eventLogEntries.length > this.maxLogEntries) {
      this.eventLogEntries.shift();
    }

    // Update DOM
    this.renderEventLog();
  }

  /**
   * Render event log
   */
  renderEventLog() {
    this.elements.eventLog.innerHTML = this.eventLogEntries
      .map(
        (entry) => `
        <div class="event-entry ${entry.cssClass}">
          <div class="event-entry-type">${entry.type}</div>
          <div class="event-entry-text">${entry.text}</div>
        </div>
      `
      )
      .join('');

    // Auto-scroll to bottom
    this.elements.eventLog.scrollTop = this.elements.eventLog.scrollHeight;
  }

  /**
   * Render game
   */
  render() {
    // Clear canvas
    this.ctx.fillStyle = '#2C3E50';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid (optional visual reference)
    this.drawGrid();

    // Draw NPCs
    this.npcs.forEach((npc) => this.drawNPC(npc));

    // Draw speech bubbles
    this.npcs.forEach((npc) => {
      if (npc.currentDialogue) {
        this.drawSpeechBubble(npc);
      }
    });
  }

  /**
   * Draw grid
   */
  drawGrid() {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < this.canvas.width; x += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < this.canvas.height; y += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  /**
   * Draw NPC
   */
  drawNPC(npc) {
    // Draw NPC circle
    this.ctx.fillStyle = npc.color;
    this.ctx.beginPath();
    this.ctx.arc(npc.x, npc.y, npc.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw outline based on activity
    this.ctx.strokeStyle = npc.currentActivity === 'talking' ? '#FFD700' : '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw name label
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(npc.name, npc.x, npc.y + npc.radius + 15);

    // Draw activity indicator (movement arrow)
    if (npc.currentActivity === 'walking' && (npc.vx !== 0 || npc.vy !== 0)) {
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.lineWidth = 2;
      const angle = Math.atan2(npc.vy, npc.vx);
      this.ctx.beginPath();
      this.ctx.moveTo(npc.x, npc.y);
      this.ctx.lineTo(npc.x + Math.cos(angle) * 30, npc.y + Math.sin(angle) * 30);
      this.ctx.stroke();

      // Arrow head
      this.ctx.beginPath();
      this.ctx.moveTo(npc.x + Math.cos(angle) * 30, npc.y + Math.sin(angle) * 30);
      this.ctx.lineTo(
        npc.x + Math.cos(angle - 0.5) * 25,
        npc.y + Math.sin(angle - 0.5) * 25
      );
      this.ctx.moveTo(npc.x + Math.cos(angle) * 30, npc.y + Math.sin(angle) * 30);
      this.ctx.lineTo(
        npc.x + Math.cos(angle + 0.5) * 25,
        npc.y + Math.sin(angle + 0.5) * 25
      );
      this.ctx.stroke();
    }
  }

  /**
   * Draw speech bubble
   */
  drawSpeechBubble(npc) {
    const bubbleWidth = 200;
    const padding = 10;
    const lineHeight = 16;

    // Wrap text
    const words = npc.currentDialogue.split(' ');
    const lines = [];
    let currentLine = '';

    this.ctx.font = '12px Arial';
    words.forEach((word) => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = this.ctx.measureText(testLine);
      if (metrics.width > bubbleWidth - padding * 2) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    lines.push(currentLine);

    const bubbleHeight = lines.length * lineHeight + padding * 2;
    const bubbleX = npc.x - bubbleWidth / 2;
    const bubbleY = npc.y - npc.radius - bubbleHeight - 20;

    // Draw bubble background
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;

    // Rounded rectangle
    this.roundRect(this.ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 10);
    this.ctx.fill();
    this.ctx.stroke();

    // Draw tail
    this.ctx.beginPath();
    this.ctx.moveTo(npc.x - 10, bubbleY + bubbleHeight);
    this.ctx.lineTo(npc.x, npc.y - npc.radius);
    this.ctx.lineTo(npc.x + 10, bubbleY + bubbleHeight);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Draw text
    this.ctx.fillStyle = '#000000';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'left';
    lines.forEach((line, index) => {
      this.ctx.fillText(line, bubbleX + padding, bubbleY + padding + (index + 1) * lineHeight);
    });
  }

  /**
   * Helper: Draw rounded rectangle
   */
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

// Expose cache utilities globally for debugging/management
window.modelCache = {
  info: async () => {
    const info = await cacheDB.getCacheInfo();
    if (info) {
      console.log('📦 Model Cache Information:');
      console.log(`  Model: ${info.modelId}`);
      console.log(`  Cached: ${info.cacheDate}`);
      console.log(`  Age: ${info.daysSince} day(s)`);
      console.log(`  Status: Active ✓`);
    } else {
      console.log('📦 No model cache found');
    }
    return info;
  },
  clear: async () => {
    const result = await cacheDB.clearModelCache();
    return result;
  },
  help: () => {
    console.log('📦 Model Cache Utilities:');
    console.log('  modelCache.info()  - Show cache information');
    console.log('  modelCache.clear() - Clear the model cache');
    console.log('  modelCache.help()  - Show this help message');
  }
};

// Initialize game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
  });
} else {
  const game = new Game();
  game.init();
}
