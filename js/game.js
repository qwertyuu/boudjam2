/**
 * Main game controller
 * Handles game loop, rendering, and event orchestration
 */

import { NPC } from './npc.js';
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
    this.initialPlayerData = null; // Store initial player data for reset
    this.eventQueue = [];
    this.isPaused = false;
    this.isModelLoaded = false;
    this.isInGame = false;
    this.wasPausedBeforeEdit = false;

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
      editCharacterBtn: null,
      editModal: null,
      editForm: null,
      editNameInput: null,
      editPersonalityInput: null,
      editMoodInput: null,
      cancelEditBtn: null,
    };

    // Event log
    this.eventLogEntries = [];
    this.maxLogEntries = 20;

    // Shared timeline - unified history of all NPC dialogues AND actions
    this.sharedTimeline = [];
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
    this.elements.editCharacterBtn = document.getElementById('edit-character-btn');
    this.elements.editModal = document.getElementById('edit-character-modal');
    this.elements.editForm = document.getElementById('edit-character-form');
    this.elements.editNameInput = document.getElementById('edit-name');
    this.elements.editPersonalityInput = document.getElementById('edit-personality');
    this.elements.editMoodInput = document.getElementById('edit-mood');
    this.elements.cancelEditBtn = document.getElementById('cancel-edit-btn');

    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Setup canvas resolution
    this.resizeCanvas();

    // Setup event listeners
    this.setupEventListeners();

    // Check WebGPU support
    if (!this.gameAI.checkWebGPU()) {
      this.elements.status.textContent = 'WebGPU non supporté. Utilisez Chrome 113+, Edge 113+ ou Firefox Nightly.';
      return;
    }

    // Initialize Setup Manager
    this.setupManager = new SetupManager((playerData) => this.startGame(playerData));
    this.setupManager.init();

    // Initialize Streaming UI
    this.streamingUI = new StreamingUI();

    // Check if we have data, if not show setup, else start
    const savedData = localStorage.getItem('my_npc_data');
    if (!savedData) {
      this.elements.loading.style.display = 'none';
      this.setupManager.show();
    } else {
      this.startGame(JSON.parse(savedData));
    }

    // Load model immediately in background
    await this.loadModel();
    this.isModelLoaded = true;
  }

  /**
   * Start the game with player data
   */
  startGame(playerData) {
    if (this.isInGame) return;

    // Ensure setup screen is hidden
    document.getElementById('setup-screen').style.display = 'none';

    this.elements.loading.style.display = 'flex'; // Show loading while world inits

    // Initialize game world with player
    this.initializeWorld(playerData);

    // Show game
    this.elements.loading.style.display = 'none';
    this.elements.container.classList.remove('hidden');

    // Resize canvas now that container is visible
    this.resizeCanvas();

    this.isInGame = true;

    // Start game loop
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  /**
   * Load AI model
   */
  async loadModel() {
    try {
      this.elements.status.textContent = 'Chargement du modèle IA...';

      const progressCallback = (info) => {
        if (info.status === 'progress') {
          const percentage = Math.round((info.loaded / info.total) * 100);
          this.elements.progress.value = percentage;
          this.elements.status.textContent = `Téléchargement: ${percentage}%`;
        }
      };

      await this.gameAI.initialize(progressCallback);

      this.elements.status.textContent = 'Modèle chargé! Initialisation du monde...';
    } catch (error) {
      console.error('Erreur de chargement du modèle:', error);
      this.elements.status.textContent = `Erreur: ${error.message}`;
      throw error;
    }
  }

  /**
   * Initialize game world
   */
  initializeWorld(playerData) {
    // Store initial player data for reset functionality
    this.initialPlayerData = playerData;

    // Create Player Character
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

    // Store in array for compatibility with rendering code
    this.npcs = [this.playerNPC];

    // Set world bounds for the character
    this.playerNPC.setWorldBounds(this.canvas.width, this.canvas.height);

    // Create event generator
    this.eventGenerator = new EventGenerator(this);

    // Initialize Network
    this.networkManager = new NetworkManager(this);
    this.networkManager.connect(playerData);

    // Add initial world event
    this.addEventLogEntry('Jeu Démarré', 'Bienvenue dans le Monde Autonome!');
  }

  /**
   * Resize canvas to match display size and handle high DPI screens
   */
  resizeCanvas() {
    const container = this.elements.container || document.getElementById('game-container');
    const dpr = window.devicePixelRatio || 1;

    // Get the display size (CSS size)
    let displayWidth = container.clientWidth;
    let displayHeight = container.clientHeight;

    // Fallback to window size if container is not visible yet
    if (displayWidth === 0 || displayHeight === 0) {
      displayWidth = window.innerWidth;
      displayHeight = window.innerHeight;
    }

    // Set the canvas internal resolution
    this.canvas.width = displayWidth * dpr;
    this.canvas.height = displayHeight * dpr;

    // Get a fresh context reference and scale it
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);

    // Set the canvas CSS size to match the container
    this.canvas.style.width = displayWidth + 'px';
    this.canvas.style.height = displayHeight + 'px';

    console.log(`Canvas resized: ${displayWidth}x${displayHeight} (DPR: ${dpr})`);

    // Update NPC world bounds if they exist
    if (this.npcs && this.npcs.length > 0) {
      this.npcs.forEach((npc) => {
        npc.setWorldBounds(displayWidth, displayHeight);
      });
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.elements.pauseBtn.addEventListener('click', () => this.togglePause());
    this.elements.resetBtn.addEventListener('click', () => this.reset());

    // Character edit handlers
    this.elements.editCharacterBtn.addEventListener('click', () => this.openEditModal());
    this.elements.editForm.addEventListener('submit', (e) => this.handleEditSubmit(e));
    this.elements.cancelEditBtn.addEventListener('click', () => this.closeEditModal());

    // Close modal on overlay click
    this.elements.editModal.addEventListener('click', (e) => {
      if (e.target === this.elements.editModal || e.target.classList.contains('edit-modal-overlay')) {
        this.closeEditModal();
      }
    });

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.elements.editModal.classList.contains('hidden')) {
        this.closeEditModal();
      }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  /**
   * Toggle pause state
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    this.elements.pauseBtn.textContent = this.isPaused ? 'Reprendre' : 'Pause';
  }

  /**
   * Reset game
   */
  reset() {
    // Clear event queue
    this.eventQueue = [];

    // Reset player character to initial position
    if (this.playerNPC && this.initialPlayerData) {
      this.playerNPC.x = this.initialPlayerData.startX;
      this.playerNPC.y = this.initialPlayerData.startY;
      this.playerNPC.targetX = null;
      this.playerNPC.targetY = null;
      this.playerNPC.conversationHistory = [];
      this.playerNPC.currentDialogue = null;
      this.playerNPC.dialogueTimer = 0;
      this.playerNPC.currentActivity = 'idle';
      this.playerNPC.lastInteractionTime = 0;
      this.playerNPC.mood = this.initialPlayerData.mood;
    }

    // Clear event log
    this.eventLogEntries = [];
    this.elements.eventLog.innerHTML = '';
    this.addEventLogEntry('Jeu Réinitialisé', 'Le monde a été réinitialisé');

    // Reset event generator
    this.eventGenerator.lastWorldEventTime = 0;
  }

  /**
   * Open character edit modal
   */
  openEditModal() {
    if (!this.playerNPC || !this.initialPlayerData) {
      console.warn('No player character to edit');
      return;
    }

    // Populate form with current values
    this.elements.editNameInput.value = this.playerNPC.name;

    // Extract personality from "Tu es {name}. {personality}" format
    const fullPersonality = this.playerNPC.personality;
    const prefix = `Tu es ${this.playerNPC.name}. `;
    const personality = fullPersonality.startsWith(prefix)
      ? fullPersonality.substring(prefix.length)
      : fullPersonality;

    this.elements.editPersonalityInput.value = personality;
    this.elements.editMoodInput.value = this.playerNPC.mood;

    // Show modal
    this.elements.editModal.classList.remove('hidden');

    // Auto-pause game while editing
    if (!this.isPaused) {
      this.wasPausedBeforeEdit = false;
      this.togglePause();
    } else {
      this.wasPausedBeforeEdit = true;
    }

    // Focus first input
    this.elements.editNameInput.focus();
  }

  /**
   * Close character edit modal
   */
  closeEditModal() {
    this.elements.editModal.classList.add('hidden');

    // Resume game if it was auto-paused
    if (!this.wasPausedBeforeEdit && this.isPaused) {
      this.togglePause();
    }
  }

  /**
   * Handle edit form submission
   */
  handleEditSubmit(e) {
    e.preventDefault();

    const name = this.elements.editNameInput.value.trim();
    const personality = this.elements.editPersonalityInput.value.trim();
    const mood = this.elements.editMoodInput.value;

    if (!name || !personality) {
      alert('Veuillez remplir tous les champs !');
      return;
    }

    // Apply changes to player character
    this.updatePlayerCharacter(name, personality, mood);

    // Close modal
    this.closeEditModal();

    // Log event
    this.addEventLogEntry('Personnage Modifié', `${name} a été mis à jour`, 'character-update');
  }

  /**
   * Update player character data
   */
  updatePlayerCharacter(newName, newPersonality, newMood) {
    const oldName = this.playerNPC.name;

    // Update NPC object
    this.playerNPC.name = newName;
    this.playerNPC.personality = `Tu es ${newName}. ${newPersonality}`;
    this.playerNPC.mood = newMood;

    // Update initialPlayerData for reset functionality
    this.initialPlayerData.name = newName;
    this.initialPlayerData.personality = newPersonality;
    this.initialPlayerData.mood = newMood;

    // Update localStorage
    localStorage.setItem('my_npc_data', JSON.stringify(this.initialPlayerData));

    // Sync with network (send updated player state)
    if (this.networkManager && this.networkManager.isConnected) {
      this.networkManager.send('PLAYER_INFO_UPDATE', {
        name: newName,
        personality: newPersonality,
        mood: newMood
      });
    }

    console.log(`Character updated: ${oldName} → ${newName} (mood: ${newMood})`);
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
      // Small delay to ensure the user perceives the end of stream naturally
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (this.streamingUI) this.streamingUI.endStream();
    }
  }

  /**
   * Handle encounter event
   */
  async handleEncounter(event) {
    const [npc1, npc2] = event.participants;

    // Only generate AI if npc1 is the local player (others will handle their own NPCs)
    if (npc1 !== this.playerNPC) {
      return;
    }

    // Check if either NPC is busy
    if (this.isBusy(npc1) || this.isBusy(npc2)) {
      console.log(`Skipping encounter: ${npc1.name} or ${npc2.name} is busy`);
      return;
    }

    // Check that NPCs are not the same
    if (npc1.id === npc2.id) {
      console.log(`Skipping encounter: ${npc1.name} is the same as ${npc2.name}`);
      return;
    }

    this.addEventLogEntry('Rencontre', `${npc1.name} rencontre ${npc2.name}`, 'encounter');

    // NPC1 initiates conversation
    try {
      const sharedContext = this.getUnifiedTimeline(npc1, 10) + this.getRecentEventContext(2);
      await this.generateWithStreaming(
        npc1,
        `Tu rencontres ${npc2.name}. Salue-le et commente ta rencontre avec lui ici.`,
        '',
        sharedContext
      );

      // Add to shared history
      if (npc1.currentDialogue) {
        this.addToSharedHistory(npc1.name, npc1.currentDialogue, 'dialogue');
      }
      if (npc1.currentAction) {
        this.addToSharedHistory(npc1.name, npc1.currentAction, 'action');
      }

      // Queue NPC2's response (only if npc1 said or did something)
      if (npc1.currentDialogue || npc1.currentAction) {
        const whatHappened = npc1.currentDialogue
          ? `a dit: "${npc1.currentDialogue}"`
          : `a fait: ${npc1.currentAction}`;
        this.eventQueue.push({
          type: EVENT_TYPES.RESPONSE,
          participants: [npc2, npc1],
          context: `Réponds à ${npc1.name} qui ${whatHappened}`,
          timestamp: Date.now(),
        });
      }

      // Update interaction times
      npc1.lastInteractionTime = Date.now();
      npc2.lastInteractionTime = Date.now();

      // Broadcast to other players
      if (this.networkManager) {
        if (npc1.currentDialogue) {
          this.networkManager.sendEvent('DIALOGUE', {
            text: npc1.currentDialogue,
            duration: 6000
          });
        }
        if (npc1.currentAction) {
          this.networkManager.sendEvent('ACTION', {
            text: npc1.currentAction,
            duration: 6000
          });
        }
      }

    } catch (error) {
      console.error('Erreur lors de la génération de la réponse de rencontre:', error);
    }
  }

  /**
   * Handle discovery event
   */
  async handleDiscovery(event) {
    const [npc] = event.participants;

    // Only generate AI for local player
    if (npc !== this.playerNPC) {
      return;
    }

    if (this.isBusy(npc)) {
      console.log(`Skipping discovery: ${npc.name} is busy`);
      return;
    }

    this.addEventLogEntry('Découverte', `${npc.name} découvre ${event.discovery}`, 'discovery');

    try {
      const sharedContext = this.getUnifiedTimeline(npc, 10) + this.getRecentEventContext(2);
      await this.generateWithStreaming(
        npc,
        `Tu découvres ${event.discovery}. Quelle est ta réaction?`,
        '',
        sharedContext
      );

      // Add to shared history
      if (npc.currentDialogue) {
        this.addToSharedHistory(npc.name, npc.currentDialogue, 'dialogue');
      }
      if (npc.currentAction) {
        this.addToSharedHistory(npc.name, npc.currentAction, 'action');
      }

      // Broadcast to other players
      if (this.networkManager) {
        if (npc.currentDialogue) {
          this.networkManager.sendEvent('DIALOGUE', {
            text: npc.currentDialogue,
            duration: 6000
          });
        }
        if (npc.currentAction) {
          this.networkManager.sendEvent('ACTION', {
            text: npc.currentAction,
            duration: 6000
          });
        }
      }

    } catch (error) {
      console.error('Erreur lors de la génération de la réponse de découverte:', error);
    }
  }

  /**
   * Handle world event
   */
  async handleWorldEvent(event) {
    this.addEventLogEntry('Événement Mondial', event.context, 'world-event');

    // Only the local player NPC reacts to world events
    const npc = this.playerNPC;

    // Skip if local player is busy
    if (npc.currentActivity === 'talking' || npc.currentActivity === 'thinking') {
      return;
    }

    try {
      const sharedContext = this.getUnifiedTimeline(npc, 10) + this.getRecentEventContext(2);
      await this.generateWithStreaming(
        npc,
        `${event.context}. Qu'observes-tu ou que penses-tu de cela?`,
        '',
        sharedContext
      );

      // Add to shared history
      if (npc.currentDialogue) {
        this.addToSharedHistory(npc.name, npc.currentDialogue, 'dialogue');
      }
      if (npc.currentAction) {
        this.addToSharedHistory(npc.name, npc.currentAction, 'action');
      }

      // Broadcast to other players
      if (this.networkManager) {
        if (npc.currentDialogue) {
          this.networkManager.sendEvent('DIALOGUE', {
            text: npc.currentDialogue,
            duration: 6000
          });
        }
        if (npc.currentAction) {
          this.networkManager.sendEvent('ACTION', {
            text: npc.currentAction,
            duration: 6000
          });
        }
      }

    } catch (error) {
      console.error('Erreur lors de la génération de la réponse à l\'événement mondial:', error);
    }
  }

  /**
   * Handle observation event
   */
  async handleObservation(event) {
    const [npc] = event.participants;

    // Only generate AI for local player
    if (npc !== this.playerNPC) {
      return;
    }

    if (this.isBusy(npc)) {
      console.log(`Skipping observation: ${npc.name} is busy`);
      return;
    }

    this.addEventLogEntry('Observation', event.context, 'observation');

    try {
      const sharedContext = this.getUnifiedTimeline(npc, 10) + this.getRecentEventContext(2);
      await this.generateWithStreaming(
        npc,
        `Tu t'arrêtes pour observer tes alentours. Que remarques-tu ou que penses-tu?`,
        '',
        sharedContext
      );

      // Add to shared history
      if (npc.currentDialogue) {
        this.addToSharedHistory(npc.name, npc.currentDialogue, 'dialogue');
      }
      if (npc.currentAction) {
        this.addToSharedHistory(npc.name, npc.currentAction, 'action');
      }

      // Broadcast to other players
      if (this.networkManager) {
        if (npc.currentDialogue) {
          this.networkManager.sendEvent('DIALOGUE', {
            text: npc.currentDialogue,
            duration: 6000
          });
        }
        if (npc.currentAction) {
          this.networkManager.sendEvent('ACTION', {
            text: npc.currentAction,
            duration: 6000
          });
        }
      }

    } catch (error) {
      console.error('Erreur lors de la génération de la réponse d\'observation:', error);
    }
  }

  /**
   * Handle response event (NPC responding to another)
   */
  async handleResponse(event) {
    const [npc, otherNpc] = event.participants;

    // Only generate AI for local player
    if (npc !== this.playerNPC) {
      return;
    }

    if (this.isBusy(npc)) {
      console.log(`Skipping response: ${npc.name} is busy`);
      return;
    }

    try {
      const sharedContext = this.getUnifiedTimeline(npc, 10) + this.getRecentEventContext(2);
      await this.generateWithStreaming(
        npc,
        event.context,
        '',
        sharedContext
      );

      // Add to shared history
      if (npc.currentDialogue) {
        this.addToSharedHistory(npc.name, npc.currentDialogue, 'dialogue');
      }
      if (npc.currentAction) {
        this.addToSharedHistory(npc.name, npc.currentAction, 'action');
      }

      // Broadcast to other players
      if (this.networkManager) {
        if (npc.currentDialogue) {
          this.networkManager.sendEvent('DIALOGUE', {
            text: npc.currentDialogue,
            duration: 6000
          });
        }
        if (npc.currentAction) {
          this.networkManager.sendEvent('ACTION', {
            text: npc.currentAction,
            duration: 6000
          });
        }
      }

    } catch (error) {
      console.error('Erreur lors de la génération de la réponse:', error);
    }
  }

  /**
   * Add to shared timeline (dialogues and actions)
   * Called when an NPC generates a response to track all interactions
   * @param {string} npcName - Name of the NPC
   * @param {string} content - The dialogue or action text
   * @param {string} type - Type of event: 'dialogue' or 'action' (default: 'dialogue')
   */
  addToSharedHistory(npcName, content, type = 'dialogue') {
    this.sharedTimeline.push({
      npc: npcName,
      content: content,
      type: type,
      timestamp: Date.now(),
    });

    // Debug log
    const preview = content.length > 60 ? content.substring(0, 60) + '...' : content;
    console.log(`✅ [Timeline] Added: ${npcName} (${type}): "${preview}"`);
    console.log(`   Total in timeline: ${this.sharedTimeline.length}`);
    console.log(`   NPCs so far: ${[...new Set(this.sharedTimeline.map(e => e.npc))].join(', ')}`);

    // Keep history size manageable
    if (this.sharedTimeline.length > this.maxSharedHistoryLength) {
      this.sharedTimeline = this.sharedTimeline.slice(-this.maxSharedHistoryLength);
    }
  }

  /**
   * Get unified timeline of recent events (dialogues + actions)
   * Returns formatted string with what NPCs said and did
   * Optimized for prompt size with character limit
   * @param {NPC} excludeNpc - Optionally exclude this NPC's own events
   * @param {number} limit - Max number of events to include (default 10)
   * @param {number} maxChars - Max character limit for the timeline (default 600)
   */
  getUnifiedTimeline(excludeNpc = null, limit = 10, maxChars = 600) {
    const viewerName = excludeNpc ? excludeNpc.name : '?';
    console.log(`\n📍 [getUnifiedTimeline] ${viewerName} looking at shared events...`);
    console.log(`   Total timeline: ${this.sharedTimeline.length} events`);

    if (this.sharedTimeline.length === 0) {
      console.log(`   → Empty (no events yet)`);
      return '';
    }

    // Build events backwards until we hit limits
    const events = [];
    let totalChars = 0;

    const timeline = this.sharedTimeline
      .slice()
      .reverse()
      .filter(entry => {
        // If excludeNpc is specified, exclude only THAT NPC's events
        // Otherwise include all events
        if (!excludeNpc) return true;
        return entry.npc !== excludeNpc.name;
      });

    console.log(`   → After filtering out ${excludeNpc ? excludeNpc.name : 'none'}: ${timeline.length} events`);
    if (timeline.length > 0) {
      const eventList = timeline.map(e => `${e.npc}:${e.type}`).join(', ');
      console.log(`   → Candidates: ${eventList}`);
    }

    for (const entry of timeline) {
      // Format based on type
      let formatted;
      if (entry.type === 'dialogue') {
        formatted = `${entry.npc} dit: "${entry.content}"`;
      } else if (entry.type === 'action') {
        formatted = `${entry.npc} fait: ${entry.content}`;
      } else {
        formatted = `${entry.npc}: ${entry.content}`;
      }

      // Check if adding this would exceed limits
      if (events.length >= limit || totalChars + formatted.length > maxChars) {
        break;
      }

      events.unshift(formatted);  // Add to beginning (reverse order)
      totalChars += formatted.length;
    }

    const result = events.length > 0
      ? `\nCe qui se passe autour de toi:\n${events.join('\n')}`
      : '';
    console.log(`   → Returning ${events.length} events (${result.length} chars)`);
    if (result) {
      console.log(`   → Context to show:\n${result}\n`);
    }
    return result;
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
   * Check if NPC is busy
   */
  isBusy(npc) {
    if (!npc) return false;
    return npc.currentActivity === 'talking' || npc.currentActivity === 'thinking';
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
    // Get logical dimensions (CSS size, not internal canvas resolution)
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    // Clear canvas
    this.ctx.fillStyle = '#2C3E50';
    this.ctx.fillRect(0, 0, width, height);

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

    // Draw Actions (Below characters)
    this.npcs.forEach((npc) => {
      if (npc.currentAction) {
        this.drawAction(npc);
      }
    });
  }

  /**
   * Draw grid
   */
  drawGrid() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < width; x += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < height; y += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
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
      else if (npc.mood.includes('calm') || npc.mood.includes('neutre')) emoji = '😐';
      else if (npc.mood.includes('excit') || npc.mood.includes('proud')) emoji = '🤩';
      else if (npc.mood.includes('peur') || npc.mood.includes('fear') || npc.mood.includes('effray')) emoji = '😱';
      else if (npc.mood.includes('anxieux')) emoji = '😰';
      else if (npc.mood.includes('confiant')) emoji = '😎';
      else if (npc.mood.includes('méfian')) emoji = '🤨';
      else if (npc.mood.includes('curieux')) emoji = '🤔';
      else if (npc.mood.includes('déterminé')) emoji = '😤';
      else if (npc.mood.includes('surpris')) emoji = '😲';
      else if (npc.mood.includes('fatigué')) emoji = '😴';

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

    // Get logical dimensions
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    // Calculate preferred position (centered above NPC)
    let bubbleX = npc.x - bubbleWidth / 2;
    let bubbleY = npc.y - npc.radius - bubbleHeight - 20;

    // Clamp to screen bounds with some padding
    const screenPadding = 10;
    bubbleX = Math.max(screenPadding, Math.min(bubbleX, width - bubbleWidth - screenPadding));

    // For Y, we try to keep it above. If it goes off top, we might need to clamp.
    // Ideally if it clamps to top, it might overlap NPC. That's acceptable for "visibility".
    bubbleY = Math.max(screenPadding, Math.min(bubbleY, height - bubbleHeight - screenPadding));

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

  /**
   * Draw action text below NPC
   */
  drawAction(npc) {
    const text = npc.currentAction;
    if (!text) return;

    this.ctx.font = 'italic 12px Arial';
    this.ctx.fillStyle = '#E67E22'; // Orange
    this.ctx.textAlign = 'center';

    // Position below the name
    const y = npc.y + npc.radius + 30;

    // Simple wrap or max width check?
    // For actions, usually short, let's just draw direct or clamp
    const maxWidth = 200;
    const metrics = this.ctx.measureText(text);

    if (metrics.width > maxWidth) {
      // Simple truncation if too long, or split?
      // Let's do a simple 2-line split if needed, or just let it be wide for now
      this.ctx.fillText(text, npc.x, y);
    } else {
      this.ctx.fillText(text, npc.x, y);
    }
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
