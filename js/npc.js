/**
 * NPC (Non-Player Character) class and personality definitions
 */

export class NPC {
  constructor(config) {
    // Identity
    this.id = config.id;
    this.name = config.name;
    this.personality = config.personality;

    // Position & Movement
    this.x = config.startX;
    this.y = config.startY;
    this.vx = 0;
    this.vy = 0;
    this.speed = config.speed || 50;
    this.targetX = null;
    this.targetY = null;

    // Visual
    this.color = config.color;
    this.radius = config.radius || 20;

    // AI State
    this.conversationHistory = [];
    this.localHistory = []; // Actions and dialogues history
    this.thoughts = []; // Internal thoughts history
    this.currentDialogue = null;
    this.currentAction = null; // Current physical action
    this.dialogueTimer = 0;
    this.mood = 'neutral';

    // Activity State
    this.currentActivity = 'idle';
    this.lastInteractionTime = 0;

    // Goals & Relationships (Phase 3 improvements)
    this.currentGoal = null; // NPC's current objective
    this.relationships = {}; // { npcName: { attitude: 'hostile'|'amical'|'neutre', history: [] } }

    // World bounds (set by game)
    this.worldWidth = 800;
    this.worldHeight = 600;
    this.margin = 40;
  }

  /**
   * Update movement AI
   */
  updateMovement(deltaTime) {
    // REMOTE PLAYERS: Simple dead reckoning based on current velocity
    if (this.isRemote) {
      this.x += this.vx * (deltaTime / 1000);
      this.y += this.vy * (deltaTime / 1000);

      // Update activity based on movement
      if (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1) {
        this.currentActivity = 'walking';
      } else {
        if (this.currentActivity === 'walking') this.currentActivity = 'idle';
      }

      // Keep within bounds
      this.x = Math.max(this.margin, Math.min(this.worldWidth - this.margin, this.x));
      this.y = Math.max(this.margin, Math.min(this.worldHeight - this.margin, this.y));
      return;
    }

    // LOCAL AI: Pick random target occasionally if idle
    if (!this.targetX || this.hasReachedTarget()) {
      if (Math.random() < 0.01) { // 1% chance per frame
        this.pickRandomTarget();
      }
    }

    // Move towards target
    if (this.targetX) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 5) {
        this.vx = (dx / distance) * this.speed;
        this.vy = (dy / distance) * this.speed;
        this.x += this.vx * (deltaTime / 1000);
        this.y += this.vy * (deltaTime / 1000);
        this.currentActivity = 'walking';
      } else {
        this.currentActivity = 'idle';
        this.vx = 0;
        this.vy = 0;
        this.targetX = null;
        this.targetY = null;
      }
    }

    // Keep within bounds
    this.x = Math.max(this.margin, Math.min(this.worldWidth - 2 * this.margin, this.x));
    this.y = Math.max(this.margin, Math.min(this.worldHeight - 2 * this.margin, this.y));
  }

  /**
   * Update dialogue timer
   */
  updateDialogue(deltaTime) {
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= deltaTime;
      if (this.dialogueTimer <= 0) {
        this.currentDialogue = null;
        this.currentAction = null; // Clear action too
        if (this.currentActivity === 'talking') {
          this.currentActivity = 'idle';
        }
      }
    }
  }

  /**
   * Check if NPC has reached target
   */
  hasReachedTarget() {
    if (!this.targetX) return true;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= 5;
  }

  /**
   * Pick a random target position
   */
  pickRandomTarget() {
    this.targetX = this.margin + Math.random() * (this.worldWidth - 2 * this.margin);
    this.targetY = this.margin + Math.random() * (this.worldHeight - 2 * this.margin);
  }

  /**
   * Set dialogue with display duration
   */
  setDialogue(text, duration = 10000) {
    console.log(text);
    this.currentDialogue = text;
    this.dialogueTimer = duration;
    this.currentActivity = 'talking';
    this.currentThought = null; // Clear thought when talking
  }

  /**
 * Set action with display duration
 */
  setAction(text, duration = 6000) {
    console.log(`(Action) ${text}`);
    this.currentAction = text;
    // Don't overwrite timer if dialogue is longer... ideally we track separately but sharing is simpler for now
    if (this.dialogueTimer < duration) {
      this.dialogueTimer = duration;
    }
  }

  /**
   * Set thought with display duration
   */
  setThought(text, duration = 5000) {
    console.log(`(Thinking) ${text}`);
    this.currentThought = text;
    this.dialogueTimer = duration; // Reuse timer for simplicity
    this.currentActivity = 'thinking';
  }

  /**
   * Update relationship with another NPC
   */
  updateRelationship(npcName, attitude, interaction = null) {
    if (!this.relationships[npcName]) {
      this.relationships[npcName] = { attitude: 'neutre', history: [] };
    }
    this.relationships[npcName].attitude = attitude;
    if (interaction) {
      this.relationships[npcName].history.push(interaction);
      // Keep only last 3 interactions
      if (this.relationships[npcName].history.length > 3) {
        this.relationships[npcName].history = this.relationships[npcName].history.slice(-3);
      }
    }
  }

  /**
   * Get relationship info for prompt context
   */
  getRelationshipsContext() {
    if (Object.keys(this.relationships).length === 0) return '';

    const relations = Object.entries(this.relationships)
      .map(([name, rel]) => {
        const attitude = rel.attitude.toUpperCase();
        const history = rel.history.length > 0 ? ` (${rel.history[rel.history.length - 1]})` : '';
        return `- ${name}: ${attitude}${history}`;
      })
      .join('\n');

    return `# Relations\n${relations}`;
  }

  /**
   * Set world bounds (called by game)
   */
  setWorldBounds(width, height) {
    this.worldWidth = width;
    this.worldHeight = height;
  }
}
