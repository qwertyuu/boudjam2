// storage.js - IndexedDB storage system for player data

const DB_NAME = 'NPCGameDB';
const DB_VERSION = 1;
const STORE_NAME = 'players';

let db = null;

// Initialize IndexedDB
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'playerId' });
        objectStore.createIndex('name', 'npc.name', { unique: false });
      }
    };
  });
}

// Save player data
export async function savePlayerData(playerData) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.put(playerData);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Load player data by ID
export async function loadPlayerData(playerId) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(playerId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get all players
export async function getAllPlayers() {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Delete player data
export async function deletePlayerData(playerId) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(playerId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Create new player data structure
export function createPlayerData(playerId, npc) {
  return {
    playerId,
    npc: {
      name: npc.name,
      personality: npc.personality,
      mood: npc.mood,
      objective: npc.objective || ''
    },
    history: [],
    currentState: {
      mood: npc.mood,
      position: 'world',
      lastAction: null,
      lastDialogue: null,
      lastThought: null
    }
  };
}

// Add entry to history
export function addHistoryEntry(playerData, entry) {
  playerData.history.push({
    timestamp: Date.now(),
    action: entry.action || '',
    dialogue: entry.dialogue || '',
    thought: entry.thought || '',
    mood: entry.mood || playerData.currentState.mood,
    rawOutput: entry.rawOutput || ''
  });

  // Keep only last 50 entries to save memory
  if (playerData.history.length > 50) {
    playerData.history = playerData.history.slice(-50);
  }

  return playerData;
}
