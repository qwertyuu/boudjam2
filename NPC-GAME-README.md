# 🎮 NPC Autonomous Multiplayer Game - Implementation Guide

## Overview

This project has been transformed into a multiplayer autonomous NPC simulation game where each player controls one NPC that acts independently using AI. The implementation follows the specifications in `SPECS.md`.

## 🚀 Getting Started

### Quick Start

1. Open `config.html` in a WebGPU-enabled browser (Chrome 113+, Edge 113+)
2. Configure your NPC (name, personality, mood, objective)
3. Click "Rejoindre la simulation" to enter the game
4. Watch your NPC interact autonomously with the world

### Browser Requirements

- **Chrome/Edge 113+** with WebGPU enabled
- **Firefox Nightly** with WebGPU flag enabled
- Local server recommended (VS Code Live Server, Python http.server, etc.)

## 📁 Architecture

### New Files Created

#### HTML Files
- **`config.html`** - NPC configuration screen (pre-game setup)
- **`npc-game.html`** - Main game screen with NPC world simulation

#### JavaScript Modules
- **`js/storage.js`** - IndexedDB storage for player data
- **`js/extractor.js`** - Regex-based content extraction (ACTION/DIALOGUE/PENSÉE/MOOD)
- **`js/mood.js`** - Mood system with emojis and colors
- **`js/prompts.js`** - Prompt building (system + user messages only)
- **`js/gameloop.js`** - Async NPC generation loop
- **`js/config.js`** - Configuration screen controller
- **`js/npc-game.js`** - Main game controller
- **`js/broadcast.js`** - Cross-tab NPC action broadcasting (already existed)

#### CSS Files
- **`css/config.css`** - Configuration screen styles
- **`css/npc-game.css`** - Game screen styles with NPC cards, streaming zones, events

### Existing Files (Unchanged)
- `index.html` - Original chat interface
- `js/app.js` - Original chat app
- `js/chat.js` - Original chat functionality
- `css/styles.css` - Original styles

## 🎯 Key Features Implemented

### 1. Configuration System (SPECS.md §1.2, §7.1)
- Pre-game NPC setup form
- Fields: name, personality, initial mood, objective
- Form validation and character counters
- UUID-based player IDs
- IndexedDB storage

### 2. Decentralized Storage (SPECS.md §1.3, §8.1)
- IndexedDB for persistent player data
- Structure: `{ playerId, npc, history, currentState }`
- Local storage for each player
- History limited to last 50 entries for performance

### 3. Message System (SPECS.md §2)
- **NO assistant role** (system + user only)
- System prompt: game rules, output format, constraints
- User prompt: NPC context (name, personality, mood, history, other NPCs)
- Single user message with complete context

### 4. Content Extraction (SPECS.md §3)
- Regex-based extraction (no JSON parsing)
- Markers: `ACTION:`, `DIALOGUE:`, `PENSÉE:`, `MOOD:`
- Fallback strategies for partial/failed extraction
- Never blocks simulation

### 5. Streaming Visualization (SPECS.md §4)
- Real-time token-by-token display
- Dedicated streaming zone with blinking cursor animation
- Post-generation parsing and UI update
- Raw text visible during generation

### 6. Mood System (SPECS.md §5)
- 12 predefined moods (French names)
- Each mood has emoji + color
- Visual mood badges and color indicators
- Mood evolution based on AI generation

### 7. Game Loop (SPECS.md §9)
- Async generation for each NPC
- Cycle: prompt → generate → extract → update → save → broadcast → wait
- Error handling with fallback (never blocks)
- Configurable speed (1-10 seconds)

### 8. Multiplayer Support (SPECS.md §8.2)
- localStorage-based broadcast system
- Cross-tab communication
- Each player sees other NPCs' actions
- Separate event log for your NPC vs others

### 9. Game UI (SPECS.md §7.2, §7.3)
- Main NPC card (your NPC with full details)
- Other NPCs list (visible actions/dialogues only)
- Event log with timestamps
- Controls: Pause/Play, History viewer, Speed slider, Reset

### 10. Resilience (SPECS.md §6)
- Partial extraction: uses available fields
- Failed extraction: keeps previous state, logs error
- Default action: "réfléchit" or "regarde autour"
- No simulation blocking on errors

## 🔄 Game Flow

```
1. User opens config.html
2. Fills NPC configuration form
3. Data saved to IndexedDB + localStorage
4. Redirects to npc-game.html
5. Model loading (Ministral-3-3B)
6. Game screen appears
7. NPC loop starts:
   ├─ Build prompt (system + user)
   ├─ Generate with streaming
   ├─ Show streaming text in real-time
   ├─ Extract ACTION/DIALOGUE/PENSÉE/MOOD
   ├─ Update NPC state
   ├─ Save to IndexedDB
   ├─ Broadcast to other tabs
   ├─ Update UI
   └─ Wait X seconds → repeat
```

## 🛠️ Technical Details

### Storage Schema
```javascript
{
  playerId: "player_1234567890_abc123",
  npc: {
    name: "Jean",
    personality: "Curieux et aventureux",
    mood: "joyeux",
    objective: "Explorer le monde"
  },
  history: [
    {
      timestamp: 1234567890,
      action: "regarde autour",
      dialogue: "Bonjour!",
      thought: "Que faire maintenant?",
      mood: "joyeux",
      rawOutput: "ACTION: regarde autour\n..."
    }
  ],
  currentState: {
    mood: "joyeux",
    position: "world",
    lastAction: "regarde autour",
    lastDialogue: "Bonjour!",
    lastThought: "Que faire maintenant?"
  }
}
```

### Prompt Structure
```
SYSTEM:
Tu es un simulateur de personnage...
FORMAT: ACTION: ... DIALOGUE: ... PENSÉE: ... MOOD: ...

USER:
[NPC: Jean]
[Personnalité: Curieux et aventureux]
[Mood actuel: joyeux]
[Historique récent: ...]
[Situation actuelle: ...]
[Autres NPCs visibles: ...]
Que fait Jean maintenant?
```

### Extraction Regex
- `ACTION:\s*(.+?)(?=DIALOGUE:|PENSÉE:|MOOD:|$)`
- `DIALOGUE:\s*(.+?)(?=ACTION:|PENSÉE:|MOOD:|$)`
- `PENSÉE:\s*(.+?)(?=ACTION:|DIALOGUE:|MOOD:|$)`
- `MOOD:\s*(.+?)(?=ACTION:|DIALOGUE:|PENSÉE:|$)`

## 🎨 UI Components

### Config Screen
- Clean form with validation
- Character counters
- Mood dropdown with emojis
- Gradient background

### Game Screen
- **Main Panel**: Your NPC card with full status
- **Side Panel**: Other NPCs list
- **Events Panel**: Scrollable event log
- **Streaming Zone**: Real-time AI generation display
- **Controls**: Pause, History, Reset, Speed slider

### Mood Visualization
- Emoji indicators (😊, 😢, 😠, etc.)
- Color-coded badges
- Border colors on NPC cards

## 📊 Performance Optimizations (SPECS.md §10)

- History limited to 50 entries
- Model uses fp16 quantization
- MAX_NEW_TOKENS: 512
- Configurable generation speed
- Efficient IndexedDB queries

## 🔧 Configuration Options

### Speed Control
- Range: 1-10 seconds between generations
- Default: 5 seconds
- Adjustable via slider during gameplay

### Model Settings
- Model: `mistralai/Ministral-3-3B-Instruct-2512-ONNX`
- Device: WebGPU
- Dtype: fp16
- Max tokens: 512
- Temperature: 0.8

## 🐛 Error Handling

- **Model load failure**: Shows error on loading screen
- **Extraction failure**: Uses fallback text, continues simulation
- **Save failure**: Logs error, continues without blocking
- **Broadcast failure**: Logs error, NPC continues locally
- **Generation error**: Uses default action ("regarde autour")

## 🚧 Future Enhancements

Potential additions (not in current specs):
- Server-based multiplayer (replace localStorage broadcast)
- Visual world map/canvas
- NPC-to-NPC direct interactions
- Persistent world state
- Export/import NPC configurations
- Theme switching

## 📝 Testing

### Local Testing
1. Start local server: `python -m http.server 5501`
2. Open `http://localhost:5501/config.html`
3. Create your first NPC
4. Watch autonomous behavior

### Multi-Tab Testing
1. Open `config.html` in multiple tabs
2. Create different NPCs in each tab
3. Watch them interact via broadcasts
4. Check event logs in each tab

## ✅ Specifications Compliance

All requirements from `SPECS.md` have been implemented:
- ✅ Section 1: Multiplayer architecture
- ✅ Section 2: Generation without assistant role
- ✅ Section 3: Regex extraction
- ✅ Section 4: Real-time streaming
- ✅ Section 5: Mood system
- ✅ Section 6: Resilience strategies
- ✅ Section 7: UI (config + game screens)
- ✅ Section 8: Decentralized storage + broadcast
- ✅ Section 9: Async game loop
- ✅ Section 10: Performance optimizations

## 🎓 Code Organization

### Separation of Concerns
- **Storage** (`storage.js`): Data persistence
- **Extraction** (`extractor.js`): Content parsing
- **Mood** (`mood.js`): Mood system logic
- **Prompts** (`prompts.js`): Prompt building
- **Game Loop** (`gameloop.js`): Generation orchestration
- **Broadcast** (`broadcast.js`): Inter-tab communication
- **Controllers** (`config.js`, `npc-game.js`): UI logic

### Module Dependencies
```
npc-game.js
  ├─ storage.js
  ├─ gameloop.js
  │   ├─ prompts.js
  │   ├─ extractor.js
  │   ├─ storage.js
  │   ├─ mood.js
  │   └─ broadcast.js
  ├─ broadcast.js
  └─ mood.js
```

---

**Built with ❤️ using Claude Sonnet 4.5 and multiple scoped Haiku workers**
