/**
 * Event system for generating and managing game events
 */

export const EVENT_TYPES = {
  ENCOUNTER: 'encounter',
  DISCOVERY: 'discovery',
  WORLD_EVENT: 'world_event',
  OBSERVATION: 'observation',
  RESPONSE: 'response', // NPC responding to another NPC
};

export const EVENT_TRIGGERS = {
  PROXIMITY_THRESHOLD: 100, // pixels
  DISCOVERY_CHANCE: 0.001, // Reduced: 0.1% per frame when idle
  WORLD_EVENT_INTERVAL: 60000, // Increased: 60 seconds
  OBSERVATION_CHANCE: 0.001, // Reduced: 0.1% per frame
};

export class EventGenerator {
  constructor(game) {
    this.game = game;
    this.lastWorldEventTime = 0;

    this.discoveryPool = [
      'un cristal brillant',
      'des ruines anciennes',
      'un tome mystérieux',
      'une étrange empreinte',
      'un trésor caché',
      'un artefact magique',
      'une vieille épée plantée dans la pierre',
      'un corbeau qui parle',
      'une potion étincelante',
      'des runes mystérieuses gravées dans la pierre',
      'un sanctuaire oublié',
      'un coffre plein de pièces d\'or',
    ];

    this.worldEvents = [
      'Une météore traverse le ciel',
      'Du tonnerre gronde au loin',
      'Un brouillard mystérieux s\'installe',
      'Des lumières étranges apparaissent à l\'horizon',
      'Le vent chuchote des paroles anciennes',
      'Un rugissement lointain résonne à travers le pays',
      'Le sol tremble légèrement',
      'Une étoile filante traverse les cieux',
      'Un silence étrange s\'abat sur la terre',
      'L\'air devient soudainement froid',
      'Un vol de corbeaux tourne dans le ciel',
      'La lune brille d\'une luminosité inaccoutumée',
    ];

    this.observationPrompts = [
      'observe ses alentours avec attention',
      'remarque quelque chose d\'intéressant à proximité',
      'réfléchit aux événements récents',
      'contemple la nature de son voyage',
      'considère le chemin à venir',
      'prend un moment pour se reposer et penser',
    ];
  }

  /**
   * Check for proximity-based events (NPCs meeting)
   */
  checkProximityEvents(npcs) {
    const events = [];

    // Check all NPC pairs
    for (let i = 0; i < npcs.length; i++) {
      for (let j = i + 1; j < npcs.length; j++) {
        const npc1 = npcs[i];
        const npc2 = npcs[j];

        // Skip if either is busy
        if (this.isBusy(npc1) || this.isBusy(npc2)) continue;

        const distance = this.getDistance(npc1, npc2);

        if (distance < EVENT_TRIGGERS.PROXIMITY_THRESHOLD) {
          // Check if they haven't interacted recently
          const timeSinceInteraction = Date.now() - Math.max(
            npc1.lastInteractionTime,
            npc2.lastInteractionTime
          );

          if (timeSinceInteraction > 10000) { // 10 second cooldown
            events.push({
              type: EVENT_TYPES.ENCOUNTER,
              participants: [npc1, npc2],
              context: `${npc1.name} meets ${npc2.name}`,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    return events;
  }

  /**
   * Check for discovery events (NPCs finding things)
   */
  checkDiscoveryEvents(npcs) {
    const events = [];

    npcs.forEach((npc) => {
      // Strict idle check
      if (!this.isBusy(npc) && npc.currentActivity === 'idle' && Math.random() < EVENT_TRIGGERS.DISCOVERY_CHANCE) {
        const discovery = this.discoveryPool[Math.floor(Math.random() * this.discoveryPool.length)];
        events.push({
          type: EVENT_TYPES.DISCOVERY,
          participants: [npc],
          context: `${npc.name} discovers ${discovery}`,
          discovery: discovery,
          timestamp: Date.now(),
        });
      }
    });

    return events;
  }

  /**
   * Check for world events (environmental changes)
   */
  checkWorldEvents() {
    const now = Date.now();
    if (now - this.lastWorldEventTime > EVENT_TRIGGERS.WORLD_EVENT_INTERVAL) {
      this.lastWorldEventTime = now;

      const event = this.worldEvents[Math.floor(Math.random() * this.worldEvents.length)];

      return [
        {
          type: EVENT_TYPES.WORLD_EVENT,
          participants: this.game.npcs,
          context: event,
          timestamp: now,
        },
      ];
    }

    return [];
  }

  /**
   * Check for observation events (NPCs commenting on surroundings)
   */
  checkObservationEvents(npcs) {
    const events = [];

    npcs.forEach((npc) => {
      // Skip if busy
      if (this.isBusy(npc)) return;

      if (Math.random() < EVENT_TRIGGERS.OBSERVATION_CHANCE) {
        const prompt = this.observationPrompts[Math.floor(Math.random() * this.observationPrompts.length)];
        events.push({
          type: EVENT_TYPES.OBSERVATION,
          participants: [npc],
          context: `${npc.name} ${prompt}`,
          timestamp: Date.now(),
        });
      }
    });

    return events;
  }

  /**
   * Check if NPC is busy (talking or thinking)
   */
  isBusy(npc) {
    return npc.currentActivity === 'talking' || npc.currentActivity === 'thinking';
  }

  /**
   * Calculate distance between two NPCs
   */
  getDistance(npc1, npc2) {
    const dx = npc1.x - npc2.x;
    const dy = npc1.y - npc2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
