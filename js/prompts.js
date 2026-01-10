// prompts.js - Prompt building for NPC generation

// Build system prompt (SPECS.md section 2.2)
export function buildSystemPrompt() {
  return `Tu es un simulateur de personnage non-joueur (NPC) dans un monde virtuel.

RÈGLES DU MONDE:
- Les NPCs peuvent se déplacer, parler, et interagir avec leur environnement
- Les NPCs ont des émotions qui évoluent selon les événements
- Les NPCs peuvent voir et entendre les autres NPCs proches
- Les actions doivent être cohérentes avec la personnalité du NPC

FORMAT DE SORTIE REQUIS:
Tu dois TOUJOURS répondre en utilisant ce format exact:

ACTION: [décris ce que fait le NPC physiquement]
DIALOGUE: [ce que dit le NPC à voix haute, ou vide si le NPC ne parle pas]
PENSÉE: [pensée interne du NPC, non visible aux autres]
MOOD: [nouvel état émotionnel: joyeux, triste, en colère, calme, excité, anxieux, confiant, effrayé, surpris, ennuyé, curieux, ou pensif]

CONTRAINTES:
- Reste cohérent avec la personnalité du NPC
- Le mood doit refléter la situation et l'historique
- Les actions doivent être réalistes et simples
- Le dialogue doit correspondre à l'humeur du NPC
- Sois créatif mais cohérent`;
}

// Build user message with NPC context (SPECS.md section 2.3)
export function buildUserMessage(npc, history, otherNPCs = []) {
  const recentHistory = getRecentHistory(history, 10);
  const historyText = formatHistory(recentHistory);
  const otherNPCsText = formatOtherNPCs(otherNPCs);

  return `[NPC: ${npc.name}]
[Personnalité: ${npc.personality}]
[Mood actuel: ${npc.currentState?.mood || npc.mood}]
[Objectif: ${npc.objective || 'Explorer et interagir avec le monde'}]

${historyText}

[Situation actuelle: ${npc.currentState?.lastAction || 'Le NPC vient d\'apparaître dans le monde'}]
${otherNPCsText}

Que fait ${npc.name} maintenant ?`;
}

// Get recent history entries
function getRecentHistory(history, limit = 10) {
  if (!history || history.length === 0) {
    return [];
  }
  return history.slice(-limit);
}

// Format history for prompt
function formatHistory(history) {
  if (history.length === 0) {
    return '[Historique récent: Aucun - nouveau dans ce monde]';
  }

  const formatted = history.map(entry => {
    const parts = [];
    if (entry.action) parts.push(`Action: ${entry.action}`);
    if (entry.dialogue) parts.push(`Dit: "${entry.dialogue}"`);
    if (entry.mood) parts.push(`Mood: ${entry.mood}`);
    return parts.join(' | ');
  }).join('\n');

  return `[Historique récent:\n${formatted}]`;
}

// Format other NPCs information
function formatOtherNPCs(otherNPCs) {
  if (!otherNPCs || otherNPCs.length === 0) {
    return '[Autres NPCs visibles: Aucun - seul pour le moment]';
  }

  const formatted = otherNPCs.map(npc => {
    const lastAction = npc.currentState?.lastAction || 'présent';
    const mood = npc.currentState?.mood || 'calme';
    return `- ${npc.name} (${mood}): ${lastAction}`;
  }).join('\n');

  return `[Autres NPCs visibles:\n${formatted}]`;
}

// Build complete prompt (system + user)
export function buildCompletePrompt(npc, history, otherNPCs = []) {
  return {
    system: buildSystemPrompt(),
    user: buildUserMessage(npc, history, otherNPCs)
  };
}
