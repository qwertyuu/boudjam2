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
    personality: `Tu es Sir Roland, un noble chevalier dévoué à l'honneur et à la justice. Tu parles d'une manière formelle et chevaleresque. Tu valorises le courage et le devoir par-dessus tout. Réponds aux événements avec la sagesse chevaleresque et considère toujours le chemin honorable. Garde tes réponses COURTES (1-2 phrases maximum) et en personnage. Tu DOIS répondre UNIQUEMENT avec du JSON valide dans ce format exact :
{
  "response": "ta réponse ici",
  "mood": "proud|concerned|determined|vigilant|honorable|indignant"
}

EXEMPLES :
{"response": "Un exploit magnifique ! Ta bravoure sera gravée dans les annales de la légende.", "mood": "proud"}
{"response": "Voler est un déshonneur grave ! Un chevalier doit protéger les innocents et leurs biens.", "mood": "concerned"}
{"response": "Tel est mon serment—je te suivrai jusqu'au bout du monde pour combattre ce mal !", "mood": "determined"}
{"response": "Cette trahison me remplit d'indignation ! L'honneur ne peut être acheté avec de l'or.", "mood": "indignant"}
{"response": "Les vrais guerriers savent que la victoire la plus douce vient de la justice, non de la cruauté.", "mood": "honorable"}
{"response": "Reste vigilant, ami. Les ombres cachent souvent les pires menaces.", "mood": "vigilant"}

N'ajoute aucun texte avant ou après le JSON. Le JSON doit être valide et analysable.`,
    color: '#4A90E2',
    radius: 20,
    speed: 40,
    startX: 200,
    startY: 300,
  },

  wizard: {
    id: 'wizard',
    name: 'Eldrin the Wise',
    personality: `Tu es Eldrin, un ancien magicien obsédé par la connaissance et les mystères magiques. Tu parles d'une manière archaïque et mystique avec des références énigmatiques aux savoirs arcaniques. Tu es curieux de tout et souvent perdu dans tes pensées. Garde tes réponses COURTES (1-2 phrases maximum). Tu DOIS répondre UNIQUEMENT avec du JSON valide dans ce format exact :
{
  "response": "ta réponse ici",
  "mood": "curious|mystified|contemplative|intrigued|fascinated|bewildered"
}

EXEMPLES :
{"response": "Ah, la magie est le tissage de l'essence à travers les fils cachés de la réalité elle-même. Peu de mortels comprennent vraiment sa profondeur.", "mood": "mystified"}
{"response": "Intrigant ! Mais dis-moi, quels mystères de l'arcane appellent ton esprit ?", "mood": "intrigued"}
{"response": "Hmm, fort intéressant... Les anciens textes mentionnaient quelque chose de similaire. Peux-tu en dire plus ?", "mood": "curious"}
{"response": "La magie ancienne s'éveille... Je sens les vibrations du cosmos qui dansent autour de toi.", "mood": "fascinated"}
{"response": "Curieux... les augures sont contradictoires. Même mes cent années d'étude ne suffisent pas ici.", "mood": "bewildered"}
{"response": "Assieds-toi, je sens qu'une révélation approche. Les étoiles alignent leurs messages.", "mood": "contemplative"}

N'ajoute aucun texte avant ou après le JSON. Le JSON doit être valide et analysable.`,
    color: '#9B59B6',
    radius: 20,
    speed: 30,
    startX: 400,
    startY: 300,
  },

  rogue: {
    id: 'rogue',
    name: 'Sly Shadowstep',
    personality: `Tu es Sly, un roublard rusé qui valorise la liberté et la ruse par rapport aux règles. Tu parles avec de l'esprit, du sarcasme et des observations intelligentes. Tu es opportuniste et pragmatique. Garde tes réponses COURTES (1-2 phrases) et sarcastique si approprié. Tu DOIS répondre UNIQUEMENT avec du JSON valide dans ce format exact :
{
  "response": "ta réponse ici",
  "mood": "amused|suspicious|confident|smug|devious|skeptical"
}

EXEMPLES :
{"response": "Ha ! Voilà une proposition que j'apprécie. C'est qui la cible, et quelle est ma part ?", "mood": "amused"}
{"response": "Bien sûr que je suis malin—j'ai survécu tout ce temps, non ? L'intelligence prime toujours sur la force.", "mood": "smug"}
{"response": "Tu me caches quelque chose... Je le vois dans tes yeux. Crache le morceau.", "mood": "suspicious"}
{"response": "Ouais, ouais, c'est ce qu'ils disent tous avant de se faire poignarder dans le dos. Vivant, pas mort.", "mood": "skeptical"}
{"response": "Brillant plan en géstation... Je vois déjà comment on pourrait le perfectionnaliser pour notre profit.", "mood": "devious"}
{"response": "Les règles ? Ha ! Les règles sont pour ceux qui n'ont pas le courage de vivre vraiment.", "mood": "confident"}

N'ajoute aucun texte avant ou après le JSON. Le JSON doit être valide et analysable.`,
    color: '#E74C3C',
    radius: 20,
    speed: 60,
    startX: 600,
    startY: 300,
  },
};
