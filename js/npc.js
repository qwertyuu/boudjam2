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
    this.dialogueTimer = 0;
    this.mood = 'neutral';

    // Activity State
    this.currentActivity = 'idle';
    this.lastInteractionTime = 0;

    // World bounds (set by game)
    this.worldWidth = 800;
    this.worldHeight = 600;
    this.margin = 40;
  }

  /**
   * Update movement AI
   */
  updateMovement(deltaTime) {
    // Pick random target occasionally if idle
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
    this.x = Math.max(this.margin, Math.min(this.worldWidth - this.margin, this.x));
    this.y = Math.max(this.margin, Math.min(this.worldHeight - this.margin, this.y));
  }

  /**
   * Update dialogue timer
   */
  updateDialogue(deltaTime) {
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= deltaTime;
      if (this.dialogueTimer <= 0) {
        this.currentDialogue = null;
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
   * Set thought with display duration
   */
  setThought(text, duration = 5000) {
    console.log(`(Thinking) ${text}`);
    this.currentThought = text;
    this.dialogueTimer = duration; // Reuse timer for simplicity
    this.currentActivity = 'thinking';
  }

  /**
   * Set world bounds (called by game)
   */
  setWorldBounds(width, height) {
    this.worldWidth = width;
    this.worldHeight = height;
  }
}

/**
 * NPC Personality definitions with system prompts
 */
export const NPC_PERSONALITIES = {
  knight: {
    id: 'knight',
    name: 'Sir Roland',
    personality: `Tu es Sir Roland, un noble chevalier dévoué à l'honneur et à la justice. Tu parles d'une manière formelle et chevaleresque. Tu valorises le courage et le devoir par-dessus tout. Réponds aux événements avec la sagesse chevaleresque et considère toujours le chemin honorable. Garde tes réponses courtes et percutantes.`,
    color: '#4A90E2',
    radius: 20,
    speed: 40,
    startX: 200,
    startY: 300,
  },

  wizard: {
    id: 'wizard',
    name: 'Eldrin the Wise',
    personality: `Tu es Eldrin, un ancien magicien obsédé par la connaissance et les mystères magiques. Tu parles d'une manière archaïque et mystique avec des références énigmatiques aux savoirs arcaniques. Tu es curieux de tout et souvent perdu dans tes pensées.`,
    color: '#9B59B6',
    radius: 20,
    speed: 30,
    startX: 400,
    startY: 300,
  },

  rogue: {
    id: 'rogue',
    name: 'Sly Shadowstep',
    personality: `Tu es Sly, un roublard rusé qui valorise la liberté et la ruse par rapport aux règles. Tu parles avec de l'esprit, du sarcasme et des observations intelligentes. Tu es opportuniste et pragmatique.`,
    color: '#E74C3C',
    radius: 20,
    speed: 60,
    startX: 600,
    startY: 300,
  },
};
