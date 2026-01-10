// config.js - Configuration screen controller

import { initDB, savePlayerData, createPlayerData } from './storage.js';

// Initialize page
async function init() {
  await initDB();
  setupFormListeners();
  setupCharacterCounters();
}

// Setup form submission
function setupFormListeners() {
  const form = document.getElementById('npcConfigForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const npcConfig = {
      name: formData.get('npcName').trim(),
      personality: formData.get('npcPersonality').trim(),
      mood: formData.get('npcMood'),
      objective: formData.get('npcObjective').trim() || 'Explorer et interagir avec le monde'
    };

    // Validate
    if (!npcConfig.name || !npcConfig.personality || !npcConfig.mood) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      // Generate unique player ID
      const playerId = generatePlayerId();

      // Create player data structure
      const playerData = createPlayerData(playerId, npcConfig);

      // Save to IndexedDB
      await savePlayerData(playerData);

      // Store current player ID in localStorage for quick access
      localStorage.setItem('currentPlayerId', playerId);

      // Redirect to NPC game
      window.location.href = 'npc-game.html';

    } catch (error) {
      console.error('Error saving config:', error);
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
    }
  });
}

// Setup character counters
function setupCharacterCounters() {
  const personalityField = document.getElementById('npcPersonality');
  const personalityCounter = document.getElementById('personalityCount');

  const objectiveField = document.getElementById('npcObjective');
  const objectiveCounter = document.getElementById('objectiveCount');

  // Initialize counters with current values (in case of browser back navigation)
  personalityCounter.textContent = personalityField.value.length;
  objectiveCounter.textContent = objectiveField.value.length;

  personalityField.addEventListener('input', () => {
    personalityCounter.textContent = personalityField.value.length;
  });

  objectiveField.addEventListener('input', () => {
    objectiveCounter.textContent = objectiveField.value.length;
  });
}

// Generate unique player ID
function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
