// mood.js - Mood system for NPCs

// Predefined moods from SPECS.md section 5.1
export const MOODS = [
  { name: 'joyeux', emoji: '😊', color: '#FFD700' },
  { name: 'triste', emoji: '😢', color: '#4682B4' },
  { name: 'en colère', emoji: '😠', color: '#DC143C' },
  { name: 'calme', emoji: '😌', color: '#98FB98' },
  { name: 'excité', emoji: '🤩', color: '#FF69B4' },
  { name: 'anxieux', emoji: '😰', color: '#FFA500' },
  { name: 'confiant', emoji: '😎', color: '#32CD32' },
  { name: 'effrayé', emoji: '😨', color: '#8B008B' },
  { name: 'surpris', emoji: '😲', color: '#FFB6C1' },
  { name: 'ennuyé', emoji: '😑', color: '#A9A9A9' },
  { name: 'curieux', emoji: '🤔', color: '#87CEEB' },
  { name: 'pensif', emoji: '🤨', color: '#9370DB' },
];

// Get mood configuration
export function getMood(moodName) {
  if (!moodName) return MOODS[3]; // default to calme

  const normalized = moodName.toLowerCase().trim();
  const found = MOODS.find(m => m.name.toLowerCase() === normalized);
  return found || MOODS[3];
}

// Get mood emoji
export function getMoodEmoji(moodName) {
  const mood = getMood(moodName);
  return mood.emoji;
}

// Get mood color
export function getMoodColor(moodName) {
  const mood = getMood(moodName);
  return mood.color;
}

// Update mood (with validation)
export function updateMood(currentMood, newMood) {
  if (!newMood) return currentMood;

  const normalized = newMood.toLowerCase().trim();
  const isValid = MOODS.some(m => m.name.toLowerCase() === normalized);

  return isValid ? newMood : currentMood;
}

// Get all mood names (for dropdown)
export function getAllMoodNames() {
  return MOODS.map(m => m.name);
}

// Get random mood
export function getRandomMood() {
  const randomIndex = Math.floor(Math.random() * MOODS.length);
  return MOODS[randomIndex].name;
}
