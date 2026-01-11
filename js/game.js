/**
 * Main game controller
 * Handles game loop, rendering, and event orchestration
 */

import { NPC, NPC_PERSONALITIES } from './npc.js';
import { EventGenerator, EVENT_TYPES } from './events.js';
import { GameAI } from './gameAI.js';
import { chatState } from './chat.js';
import { cacheDB } from './cache.js';
import { SetupManager } from './setup.js';
import { NetworkManager } from './network.js';
import { StreamingUI } from './streaming_ui.js';

class Game {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.lastFrameTime = 0;
    this.targetFPS = 20; // Slowed down from 60 to 20 FPS
    this.frameInterval = 1000 / this.targetFPS;

    // Game state
    this.npcs = [];
    this.playerNPC = null;
    this.eventQueue = [];
    this.isPaused = false;
    this.isModelLoaded = false;
    this.isInGame = false;

    // Systems
    this.gameAI = new GameAI();
    this.eventGenerator = null;
    this.setupManager = null;
    this.setupManager = null;
    this.networkManager = null;
    this.streamingUI = null;

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

    // Shared conversation history - tracks all interactions in the game world
    this.conversationHistory = [];
    this.maxSharedHistoryLength = 50;
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

    // Initialize Setup Manager
    this.setupManager = new SetupManager((playerData) => this.startGame(playerData));
    this.setupManager.init();

    // Initialize Streaming UI
    this.streamingUI = new StreamingUI();

    // Load model immediately in background
    await this.loadModel();

    // Check if we have data, if not show setup, else start
    const savedData = localStorage.getItem('my_npc_data');
    if (!savedData) {
      this.elements.loading.style.display = 'none';
      this.setupManager.show();
    } else {
      this.startGame(JSON.parse(savedData));
    }
  }

  /**
   * Start the game with player data
   */
  startGame(playerData) {
    this.elements.loading.style.display = 'flex'; // Show loading while world inits

    // Initialize game world with player
    this.initializeWorld(playerData);

    // Show game
    this.elements.loading.style.display = 'none';
    this.elements.container.classList.remove('hidden');

    this.isInGame = true;

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
  initializeWorld(playerData) {
    // Create Default NPCs - REMOVED
    // Only player NPCs are active now

    // Create Player NPC
    this.playerNPC = new NPC({
      id: playerData.id,
      name: playerData.name,
      personality: `Tu es ${playerData.name}. ${playerData.personality}`,
      startX: playerData.startX,
      startY: playerData.startY,
      color: playerData.color,
      radius: playerData.radius,
      speed: playerData.speed
    });
    this.playerNPC.mood = playerData.mood;

    // Combine them
    this.npcs = [this.playerNPC];

    // Set world bounds for all NPCs
    this.npcs.forEach((npc) => {
      npc.setWorldBounds(this.canvas.width, this.canvas.height);
    });

    // Create event generator
    this.eventGenerator = new EventGenerator(this);

    // Initialize Network
    this.networkManager = new NetworkManager(this);
    this.networkManager.connect(playerData);

    // Add initial world event
    this.addEventLogEntry('Game Started', 'Welcome to the Autonomous World!');
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
   * Wrapper for AI generation with Visual Streaming
   */
  async generateWithStreaming(npc, prompt, context, sharedContext) {
    if (this.streamingUI) {
      this.streamingUI.startStream(npc.name);
    }

    try {
      const result = await this.gameAI.generateNPCResponse(
        npc,
        prompt,
        context,
        sharedContext,
        (token) => {
          if (this.streamingUI) this.streamingUI.appendChunk(token);
        }
      );
      return result;
    } finally {
      if (this.streamingUI) this.streamingUI.endStream();
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
      const sharedContext = this.getSharedConversationContext(npc1) + this.getRecentEventContext(2);
      await this.generateWithStreaming(
        npc1,
        `Tu rencontres ${npc2.name}. Salue-le et commente ta rencontre avec lui ici.`,
        '',
        sharedContext
      );

      // Add to shared history
      this.addToSharedHistory(npc1.name, npc1.currentDialogue);

      // Queue NPC2's response
      this.eventQueue.push({
        type: EVENT_TYPES.RESPONSE,
        participants: [npc2, npc1],
        context: `Réponds à ${npc1.name} qui a dit: "${npc1.currentDialogue}"`,
        timestamp: Date.now(),
      });

      // Update interaction times
      npc1.lastInteractionTime = Date.now();
      npc2.lastInteractionTime = Date.now();

      // Broadcast if Player NPC
      if (npc1 === this.playerNPC && this.networkManager) {
        this.networkManager.sendEvent('DIALOGUE', {
          text: npc1.currentDialogue,
          duration: 6000
        });
      }

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
      const sharedContext = this.getSharedConversationContext(npc) + this.getRecentEventContext(2);
      await this.generateWithStreaming(
        npc,
        `Tu découvres ${event.discovery}. Quelle est ta réaction?`,
        '',
        sharedContext
      );

      // Add to shared history
      if (npc.currentDialogue) {
        this.addToSharedHistory(npc.name, npc.currentDialogue);
      }
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
      const sharedContext = this.getSharedConversationContext(npc) + this.getRecentEventContext(2);
      await this.generateWithStreaming(
        npc,
        `${event.context}. Qu'observes-tu ou que penses-tu de cela?`,
        '',
        sharedContext
      );

      // Add to shared history
      if (npc.currentDialogue) {
        this.addToSharedHistory(npc.name, npc.currentDialogue);
      }
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
      const sharedContext = this.getSharedConversationContext(npc) + this.getRecentEventContext(2);
      await this.generateWithStreaming(
        npc,
        `Tu t'arrêtes pour observer tes alentours. Que remarques-tu ou que penses-tu?`,
        '',
        sharedContext
      );

      // Add to shared history
      if (npc.currentDialogue) {
        this.addToSharedHistory(npc.name, npc.currentDialogue);
      }
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
      const sharedContext = this.getSharedConversationContext(npc) + this.getRecentEventContext(2);
      await this.generateWithStreaming(
        npc,
        event.context,
        '',
        sharedContext
      );

      // Add to shared history
      if (npc.currentDialogue) {
        this.addToSharedHistory(npc.name, npc.currentDialogue);
      }
    } catch (error) {
      console.error('Error generating response:', error);
    }
  }

  /**
   * Add to shared conversation history
   * Called when an NPC generates a response to track all interactions
   */
  addToSharedHistory(npcName, message) {
    this.conversationHistory.push({
      npc: npcName,
      message: message,
      timestamp: Date.now(),
    });

    // Keep history size manageable
    if (this.conversationHistory.length > this.maxSharedHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxSharedHistoryLength);
    }
  }

  /**
   * Get context about recent conversations for an NPC
   * Returns formatted string of recent interactions other NPCs have had
   */
  getSharedConversationContext(excludeNpc = null) {
    if (this.conversationHistory.length === 0) {
      return '';
    }

    // Get last 5 conversations, excluding the NPC if specified
    const recentConversations = this.conversationHistory
      .slice(-5)
      .filter(entry => !excludeNpc || entry.npc !== excludeNpc.name)
      .map(entry => `${entry.npc} a dit: "${entry.message}"`)
      .join('\n');

    return recentConversations ? `\nConversations récentes que tu as entendu:\n${recentConversations}` : '';
  }

  /**
   * Get context about what happened near an NPC
   * Returns a summary of recent events
   */
  getRecentEventContext(limit = 3) {
    if (this.eventLogEntries.length === 0) {
      return '';
    }

    const recentEvents = this.eventLogEntries
      .slice(-limit)
      .map(entry => `- ${entry.text}`)
      .join('\n');

    return `\nChoses qui se passent autour de toi:\n${recentEvents}`;
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

    // Draw speech/thought bubble
    this.npcs.forEach((npc) => {
      if (npc.currentDialogue) {
        this.drawSpeechBubble(npc, false);
      } else if (npc.currentThought) {
        this.drawSpeechBubble(npc, true);
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
    if (npc.currentActivity === 'talking') {
      this.ctx.strokeStyle = '#FFD700'; // Gold
    } else if (npc.currentActivity === 'thinking') {
      this.ctx.strokeStyle = '#3498DB'; // Blue
    } else {
      this.ctx.strokeStyle = '#000000';
    }

    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw name label
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(npc.name, npc.x, npc.y + npc.radius + 15);

    // Draw mood emoji/indicator
    if (npc.mood) {
      this.ctx.font = '14px Arial';
      let emoji = '';
      // Simple mapping
      if (npc.mood.includes('joy') || npc.mood.includes('heureux')) emoji = '😊';
      else if (npc.mood.includes('tris') || npc.mood.includes('sad')) emoji = '😢';
      else if (npc.mood.includes('col') || npc.mood.includes('angry')) emoji = '😠';
      else if (npc.mood.includes('calm')) emoji = '😐';
      else if (npc.mood.includes('excit') || npc.mood.includes('proud')) emoji = '🤩';
      else if (npc.mood.includes('peur') || npc.mood.includes('fear')) emoji = '😱';

      if (emoji) {
        this.ctx.fillText(emoji, npc.x + npc.radius, npc.y - npc.radius);
      }
    }

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
   * Draw speech or thought bubble
   */
  drawSpeechBubble(npc, isThought = false) {
    const text = isThought ? npc.currentThought : npc.currentDialogue;
    if (!text) return;

    const bubbleWidth = 200;
    const padding = 10;
    const lineHeight = 16;

    // Wrap text
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    this.ctx.font = isThought ? 'italic 12px Arial' : '12px Arial';
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

    // Calculate preferred position (centered above NPC)
    let bubbleX = npc.x - bubbleWidth / 2;
    let bubbleY = npc.y - npc.radius - bubbleHeight - 20;

    // Clamp to screen bounds with some padding
    const screenPadding = 10;
    bubbleX = Math.max(screenPadding, Math.min(bubbleX, this.canvas.width - bubbleWidth - screenPadding));

    // For Y, we try to keep it above. If it goes off top, we might need to clamp.
    // Ideally if it clamps to top, it might overlap NPC. That's acceptable for "visibility".
    bubbleY = Math.max(screenPadding, Math.min(bubbleY, this.canvas.height - bubbleHeight - screenPadding));

    // Draw bubble background
    this.ctx.fillStyle = isThought ? 'rgba(240, 248, 255, 0.95)' : 'rgba(255, 255, 255, 0.95)'; // Slight blue for thoughts
    this.ctx.strokeStyle = isThought ? '#3498DB' : '#000000';
    this.ctx.lineWidth = 2;

    // Dashed line for thoughts
    if (isThought) {
      this.ctx.setLineDash([5, 5]);
    } else {
      this.ctx.setLineDash([]);
    }

    // Rounded rectangle
    this.roundRect(this.ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 10);
    this.ctx.fill();
    this.ctx.stroke();

    // Reset dash
    this.ctx.setLineDash([]);

    // Draw tail
    // We need to calculate where the tail connects to the bubble.
    // It should be the point on the bottom of the bubble closest to the NPC.
    const tailBaseX = Math.max(bubbleX + 20, Math.min(npc.x, bubbleX + bubbleWidth - 20));
    const tailBaseY = bubbleY + bubbleHeight;

    // Determine target point on NPC
    const npcTargetX = npc.x;
    const npcTargetY = npc.y - npc.radius;

    this.ctx.beginPath();
    if (isThought) {
      // Thought bubbles tail (circles)
      // Interpolate between tailBase and npcTarget
      const dx = npcTargetX - tailBaseX;
      const dy = npcTargetY - tailBaseY;

      this.ctx.arc(tailBaseX + dx * 0.2, tailBaseY + dy * 0.2 + 5, 4, 0, Math.PI * 2);
      this.ctx.arc(tailBaseX + dx * 0.4, tailBaseY + dy * 0.4 + 5, 3, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // Speech tail
      this.ctx.moveTo(tailBaseX - 10, tailBaseY);
      this.ctx.lineTo(npcTargetX, npcTargetY);
      this.ctx.lineTo(tailBaseX + 10, tailBaseY);
      this.ctx.closePath();
      this.ctx.fill();
      // Only stroke if we are above the NPC essentially, otherwise it might look weird crossing the bubble
      // But for simplicity, we stroke.
      this.ctx.stroke();

      // Re-fill the bubble body over the tail line where it connects to avoid the line showing inside the bubble?
      // Actually, drawing the tail AFTER the bubble stroke means the tail stroke covers the bubble border.
      // We might want to clear the border there.
      // But standard implementation usually just strokes it.

      // Let's redraw the bubble fill slightly over the tail connection if we want to hide the line.
      // But simple triangle is fine.
    }


    // Draw text
    this.ctx.fillStyle = isThought ? '#555555' : '#000000';
    this.ctx.font = isThought ? 'italic 12px Arial' : '12px Arial';
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
