// npc-game.js - Main game controller for NPC multiplayer

import { AutoProcessor, AutoModelForImageTextToText, TextStreamer } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
import { initDB, loadPlayerData, getAllPlayers, savePlayerData } from './storage.js';
import { startNPCLoop, pauseNPCLoop, resumeNPCLoop, stopNPCLoop, setLoopSpeed, isLoopPaused } from './gameloop.js';
import { subscribeToBroadcasts } from './broadcast.js';
import { getMoodEmoji, getMoodColor } from './mood.js';

const MODEL_ID = 'mistralai/Ministral-3-3B-Instruct-2512-ONNX';

let processor = null;
let model = null;
let currentPlayerData = null;
let allPlayers = [];

// Initialize
async function init() {
  try {
    await initDB();

    // Load current player
    const currentPlayerId = localStorage.getItem('currentPlayerId');
    if (!currentPlayerId) {
      // No config found, redirect to config page
      window.location.href = 'config.html';
      return;
    }

    currentPlayerData = await loadPlayerData(currentPlayerId);
    if (!currentPlayerData) {
      window.location.href = 'config.html';
      return;
    }

    // Load all players for "other NPCs"
    allPlayers = await getAllPlayers();

    // Load model
    await loadModel();

    // Setup UI
    setupUI();

    // Subscribe to broadcasts
    subscribeToBroadcasts(handleBroadcast);

    // Start game loop
    startGame();

  } catch (error) {
    console.error('Init error:', error);
    document.getElementById('loadingStatus').textContent = `Erreur: ${error.message}`;
  }
}

// Load AI model
async function loadModel() {
  const loadingScreen = document.getElementById('loadingScreen');
  const progressBar = document.getElementById('progressBar');
  const statusText = document.getElementById('loadingStatus');

  try {
    statusText.textContent = 'Chargement du processeur...';

    processor = await AutoProcessor.from_pretrained(MODEL_ID, {
      progress_callback: (progress) => {
        if (progress.status === 'progress') {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          progressBar.style.width = `${percent / 2}%`;
          statusText.textContent = `Processeur: ${percent}%`;
        }
      }
    });

    statusText.textContent = 'Chargement du modèle IA...';

    model = await AutoModelForImageTextToText.from_pretrained(MODEL_ID, {
      dtype: {
        embed_tokens: 'fp16',
        vision_encoder: 'q4',
        decoder_model_merged: 'q4f16',
      },
      device: 'webgpu',
      progress_callback: (progress) => {
        if (progress.status === 'progress') {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          progressBar.style.width = `${50 + (percent / 2)}%`;
          statusText.textContent = `Modèle: ${percent}%`;
        }
      }
    });

    progressBar.style.width = '100%';
    statusText.textContent = 'Prêt!';

    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      document.getElementById('gameScreen').classList.remove('hidden');
    }, 500);

  } catch (error) {
    throw new Error(`Erreur de chargement: ${error.message}`);
  }
}

// Setup UI
function setupUI() {
  // Display main NPC
  const mainNpcCard = document.getElementById('mainNpcCard');
  mainNpcCard.innerHTML = createNPCCardHTML(currentPlayerData, true);

  // Display other NPCs
  updateOtherNPCsList();

  // Setup controls
  setupControls();
}

// Create NPC card HTML
function createNPCCardHTML(playerData, isMain = false) {
  const mood = playerData.currentState?.mood || playerData.npc.mood;
  const emoji = getMoodEmoji(mood);
  const color = getMoodColor(mood);

  return `
    <div class="npc-header" style="border-left: 4px solid ${color}">
      <h3>${playerData.npc.name} ${emoji}</h3>
      <span class="mood-badge" style="background-color: ${color}">${mood}</span>
    </div>
    <div class="npc-body">
      <p class="personality"><strong>Personnalité:</strong> ${playerData.npc.personality}</p>
      ${playerData.npc.objective ? `<p class="objective"><strong>Objectif:</strong> ${playerData.npc.objective}</p>` : ''}
      ${isMain ? `
        <div class="npc-status">
          <div class="status-section">
            <strong>Dernière Action:</strong>
            <p id="lastAction" class="status-text">En attente...</p>
          </div>
          <div class="status-section">
            <strong>Dernier Dialogue:</strong>
            <p id="lastDialogue" class="status-text dialogue-text">-</p>
          </div>
          <div class="status-section">
            <strong>Pensée:</strong>
            <p id="lastThought" class="status-text thought-text">-</p>
          </div>
          <div id="streamingZone" class="streaming-zone hidden">
            <strong>⚡ Génération en cours...</strong>
            <p id="streamingText" class="streaming-text"></p>
          </div>
        </div>
      ` : `
        <div class="npc-status">
          <p><strong>Action:</strong> ${playerData.currentState?.lastAction || 'présent'}</p>
          ${playerData.currentState?.lastDialogue ? `<p><strong>Dit:</strong> "${playerData.currentState.lastDialogue}"</p>` : ''}
        </div>
      `}
    </div>
  `;
}

// Update other NPCs list
function updateOtherNPCsList() {
  const otherNpcsList = document.getElementById('otherNpcsList');
  const others = allPlayers.filter(p => p.playerId !== currentPlayerData.playerId);

  if (others.length === 0) {
    otherNpcsList.innerHTML = '<p class="empty-message">Aucun autre NPC pour le moment...</p>';
    return;
  }

  otherNpcsList.innerHTML = others.map(p => `
    <div class="other-npc-card">
      ${createNPCCardHTML(p, false)}
    </div>
  `).join('');
}

// Setup controls
function setupControls() {
  // Pause/Resume button
  const pauseBtn = document.getElementById('pauseBtn');
  pauseBtn.addEventListener('click', () => {
    if (isLoopPaused(currentPlayerData.playerId)) {
      resumeNPCLoop(currentPlayerData.playerId);
      pauseBtn.textContent = '⏸️ Pause';
      addEventLog('▶️ Simulation reprise');
    } else {
      pauseNPCLoop(currentPlayerData.playerId);
      pauseBtn.textContent = '▶️ Reprendre';
      addEventLog('⏸️ Simulation en pause');
    }
  });

  // History button
  const historyBtn = document.getElementById('historyBtn');
  historyBtn.addEventListener('click', showHistory);

  // Reset button
  const resetBtn = document.getElementById('resetBtn');
  resetBtn.addEventListener('click', () => {
    if (confirm('Voulez-vous vraiment réinitialiser votre NPC?')) {
      window.location.href = 'config.html';
    }
  });

  // Speed slider
  const speedSlider = document.getElementById('speedSlider');
  const speedValue = document.getElementById('speedValue');
  speedSlider.addEventListener('input', () => {
    const speed = parseInt(speedSlider.value);
    speedValue.textContent = `${(speed / 1000).toFixed(1)}s`;
    setLoopSpeed(currentPlayerData.playerId, speed);
  });

  // Clear log
  const clearLogBtn = document.getElementById('clearLogBtn');
  clearLogBtn.addEventListener('click', () => {
    document.getElementById('eventLog').innerHTML = '';
  });

  // History modal close
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  closeHistoryBtn.addEventListener('click', () => {
    document.getElementById('historyModal').classList.add('hidden');
  });
}

// Start game
function startGame() {
  const otherNPCs = allPlayers
    .filter(p => p.playerId !== currentPlayerData.playerId)
    .map(p => ({
      name: p.npc.name,
      currentState: p.currentState
    }));

  startNPCLoop(currentPlayerData, processor, model, handleNPCUpdate, {
    speed: 5000,
    otherNPCs
  });

  addEventLog(`🎮 ${currentPlayerData.npc.name} entre dans le monde!`);
}

// Handle NPC updates
function handleNPCUpdate(update) {
  switch (update.type) {
    case 'stream_start':
      document.getElementById('streamingZone').classList.remove('hidden');
      document.getElementById('streamingText').textContent = '';
      break;

    case 'stream_token':
      document.getElementById('streamingText').textContent = update.text;
      break;

    case 'generation_complete':
      document.getElementById('streamingZone').classList.add('hidden');

      // Update UI
      if (update.extracted.action) {
        document.getElementById('lastAction').textContent = update.extracted.action;
      }
      if (update.extracted.dialogue) {
        document.getElementById('lastDialogue').textContent = `"${update.extracted.dialogue}"`;
      }
      if (update.extracted.thought) {
        document.getElementById('lastThought').textContent = update.extracted.thought;
      }

      // Update mood display
      const mood = update.currentState.mood;
      const emoji = getMoodEmoji(mood);
      const npcHeader = document.querySelector('.npc-header h3');
      npcHeader.textContent = `${currentPlayerData.npc.name} ${emoji}`;

      const moodBadge = document.querySelector('.mood-badge');
      moodBadge.textContent = mood;
      moodBadge.style.backgroundColor = getMoodColor(mood);

      // Add to event log
      addEventLog(`${emoji} ${currentPlayerData.npc.name}: ${update.extracted.action}${update.extracted.dialogue ? ` | "${update.extracted.dialogue}"` : ''}`);
      break;

    case 'extraction_failed':
      console.warn('Extraction failed:', update.rawText);
      addEventLog(`⚠️ ${currentPlayerData.npc.name}: génération incohérente`);
      break;

    case 'error':
      console.error('Loop error:', update.error);
      addEventLog(`❌ Erreur: ${update.error}`);
      break;
  }
}

// Handle broadcasts from other NPCs
function handleBroadcast(broadcast) {
  if (broadcast.npcId === currentPlayerData.playerId) return;

  const emoji = getMoodEmoji(broadcast.mood || 'calme');
  addEventLog(`${emoji} ${broadcast.name}: ${broadcast.action}${broadcast.dialogue ? ` | "${broadcast.dialogue}"` : ''}`, true);

  // Reload all players to update other NPCs view
  setTimeout(async () => {
    allPlayers = await getAllPlayers();
    updateOtherNPCsList();
  }, 100);
}

// Add event to log
function addEventLog(message, isOtherNPC = false) {
  const eventLog = document.getElementById('eventLog');
  const timestamp = new Date().toLocaleTimeString('fr-FR');

  const entry = document.createElement('div');
  entry.className = `event-entry${isOtherNPC ? ' other-npc-event' : ''}`;
  entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;

  eventLog.appendChild(entry);
  eventLog.scrollTop = eventLog.scrollHeight;
}

// Show history modal
function showHistory() {
  const modal = document.getElementById('historyModal');
  const content = document.getElementById('historyContent');

  if (currentPlayerData.history.length === 0) {
    content.innerHTML = '<p class="empty-message">Aucun historique pour le moment</p>';
  } else {
    content.innerHTML = currentPlayerData.history.map(entry => {
      const date = new Date(entry.timestamp).toLocaleString('fr-FR');
      const emoji = getMoodEmoji(entry.mood);

      return `
        <div class="history-entry">
          <div class="history-header">
            <span class="history-time">${date}</span>
            <span class="history-mood">${emoji} ${entry.mood}</span>
          </div>
          ${entry.action ? `<p><strong>Action:</strong> ${entry.action}</p>` : ''}
          ${entry.dialogue ? `<p><strong>Dialogue:</strong> "${entry.dialogue}"</p>` : ''}
          ${entry.thought ? `<p><strong>Pensée:</strong> ${entry.thought}</p>` : ''}
        </div>
      `;
    }).join('');
  }

  modal.classList.remove('hidden');
}

// Start when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
