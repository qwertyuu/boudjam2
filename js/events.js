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
  DISCOVERY_CHANCE: 0.005, // 0.5% per frame when idle
  WORLD_EVENT_INTERVAL: 15000, // 15 seconds
  OBSERVATION_CHANCE: 0.003, // 0.3% per frame
};

export class EventGenerator {
  constructor(game) {
    this.game = game;
    this.lastWorldEventTime = 0;

    this.discoveryPool = [
      'a glowing crystal',
      'ancient ruins',
      'a mysterious tome',
      'a strange footprint',
      'a hidden treasure',
      'a magical artifact',
      'an old sword stuck in stone',
      'a talking raven',
      'a sparkling potion',
      'mysterious runes carved in stone',
      'a forgotten shrine',
      'a chest full of gold coins',
    ];

    this.worldEvents = [
      'A meteor streaks across the sky',
      'Thunder rumbles in the distance',
      'A mysterious fog rolls in',
      'Strange lights appear on the horizon',
      'The wind whispers ancient words',
      'A distant roar echoes through the land',
      'The ground trembles slightly',
      'A shooting star crosses the heavens',
      'An eerie silence falls over the land',
      'The air grows suddenly cold',
      'A flock of crows circles overhead',
      'The moon shines with an unusual brightness',
    ];

    this.observationPrompts = [
      'observes their surroundings thoughtfully',
      'notices something interesting nearby',
      'reflects on recent events',
      'ponders the nature of their journey',
      'considers the path ahead',
      'takes a moment to rest and think',
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
      if (npc.currentActivity === 'idle' && Math.random() < EVENT_TRIGGERS.DISCOVERY_CHANCE) {
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
   * Calculate distance between two NPCs
   */
  getDistance(npc1, npc2) {
    const dx = npc1.x - npc2.x;
    const dy = npc1.y - npc2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
