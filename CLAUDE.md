# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multiplayer autonomous NPC simulation game where each player controls an AI-driven character in a shared world. NPCs generate behavior, dialogue, and emotions in real-time using the Ministral-3-3B AI model running locally via WebGPU. The game runs entirely in the browser with a Node.js WebSocket server for multiplayer synchronization.

**Key components:**
- Browser-based game client with WebGPU-powered AI
- Node.js WebSocket server for multiplayer coordination
- Decentralized NPC state stored locally in IndexedDB
- Real-time streaming text generation with async NPC loops

## Running the Application

**Browser Client (Game):**
```bash
# Open in browser: Chrome 113+, Edge 113+, or Firefox Nightly
# Use a local web server:
python -m http.server 8000  # Then visit http://localhost:8000/game.html
# OR
npx http-server               # Then visit http://localhost:8080/game.html
```

**WebSocket Server (for multiplayer):**
```bash
npm install  # Install ws dependency
npm start    # Runs server on port 8080
```

**Docker:**
```bash
docker build -t boudjam2 .
docker run -p 8080:8080 boudjam2
```

**Browser Requirements:**
- WebGPU mandatory (Chrome 113+, Edge 113+, Firefox Nightly)
- ~2GB of available RAM for model loading
- Modern browser with ES modules support

## Architecture Overview

### Game Systems

The game is built around interconnected systems:

1. **Game Loop** (`js/game.js`):
   - Main game controller that orchestrates all systems
   - Canvas-based rendering at ~20 FPS (configurable)
   - Event queue for managing NPC actions and dialogue
   - Handles pause/play, character reset, and modal interactions

2. **NPC System** (`js/npc.js`, `js/gameAI.js`):
   - Each NPC has personality, mood, name, and local history
   - `GameAI` class wraps Ministral-3-3B for NPC text generation
   - NPCs generate responses asynchronously with their own generation timers
   - Streaming UI shows token-by-token generation in real-time

3. **Network System** (`js/network.js`, `server/server.js`):
   - WebSocket-based multiplayer synchronization
   - Server broadcasts events and player state to all connected clients
   - Local decentralized state with network updates for visibility
   - Message types: `JOIN`, `UPDATE`, `EVENT`, `PLAYER_LEFT`

4. **Event System** (`js/events.js`):
   - `EventGenerator` creates structured output from LLM responses
   - Extracts ACTION, DIALOGUE, THOUGHT, MOOD via regex pattern matching
   - Fallback behavior if parsing fails (prevents simulation lockups)

5. **Setup & UI** (`js/setup.js`, `js/streaming_ui.js`):
   - Pre-game character configuration screen
   - Character editing modal during gameplay
   - Streaming text display with animations

### Data Flow

**NPC Generation Loop:**
```
1. Construct prompt (system rules + NPC context + history)
2. Call GameAI.generateNPCResponse() with streaming
3. Display streaming tokens in real-time
4. Parse regex patterns (ACTION:, DIALOGUE:, MOOD:, etc.)
5. Update NPC state and add to shared timeline
6. Broadcast to other players via network
7. Sleep until next generation (configurable interval)
8. Repeat
```

**Message Structure:**
- **System Prompt**: Game rules, output format constraints, behavior guidelines
- **User Context**: NPC name, personality, mood, recent history (last 10 events), visible NPCs
- **No Assistant Role**: Single user message with all context (per SPECS.md requirements)

### Key Files

| File | Purpose |
|------|---------|
| `game.html` | Main game interface (setup screen, canvas, UI panels) |
| `js/game.js` | Core game loop and orchestration |
| `js/gameAI.js` | Wraps chat.js for NPC-specific generation |
| `js/network.js` | WebSocket client for multiplayer sync |
| `js/npc.js` | NPC entity with state, history, generation timer |
| `js/events.js` | Event parsing and structuring |
| `js/setup.js` | Pre-game character setup |
| `js/streaming_ui.js` | Real-time text streaming display |
| `js/chat.js` | Core Transformers.js integration (shared with original chat app) |
| `js/cache.js` | IndexedDB caching utilities |
| `server/server.js` | Node.js WebSocket server |
| `css/game.css` | Game-specific styling |
| `css/theme.css` | Color themes and visual design |

### AI Configuration

**From `chat.js`:**
- `MODEL_ID`: `mistralai/Ministral-3-3B-Instruct-2512-ONNX`
- `MAX_NEW_TOKENS`: 512 (generation limit per NPC turn)
- `Temperature`: Configured for consistency

**Generation Behavior:**
- TextStreamer enables token-by-token streaming for real-time display
- Processor applies Mistral chat template automatically
- Model reused across all NPCs when possible (memory efficient)

### Response Parsing Strategy

**Output Format** (from SPECS.md):
```
ACTION: [what the NPC does]
DIALOGUE: [what the NPC says]
PENSÉE: [internal thought]
MOOD: [new emotional state]
```

**Extraction** (in `events.js`):
- Regex patterns match each marker
- Non-greedy matching handles missing sections
- Fallback: Treat entire output as ACTION if parsing fails
- Never blocks simulation due to parse failure

### State Management

**Local (IndexedDB):**
- Player config (name, personality, mood)
- NPC history (up to 50 recent events)
- Generated responses (raw + parsed)
- Shared timeline (visible to all players)

**Network (WebSocket):**
- Broadcasts only essential updates: actions, dialogue, mood changes
- Each client reconstructs world state independently
- Low bandwidth due to lightweight event structure

## Development Notes

- **No build process**: Vanilla JavaScript with ES modules imported from CDN
- **AI model runtime**: WebGPU requires modern browser; model loads from Hugging Face CDN on startup
- **Async design**: All NPC generation is non-blocking; game loop continues even during long generations
- **Streaming UX**: Real-time token display makes slow generation feel responsive
- **Memory management**: Model disposal on page unload; shared model instance across NPCs reduces memory pressure
- **Resilience**: Simulation continues even with parse failures, incomplete extractions, or network hiccups

## Server Deployment Notes

- Server runs on port 8080 (hardcoded in `network.js:18`)
- Uses basic in-memory player storage (resets on restart)
- No persistence or database required
- Scales to hundreds of concurrent players with minimal overhead (mostly broadcasting)

## Prompting Best Practices

See `GUIDE_PROMPTING_MINISTRAL_3B.md` for comprehensive guidance. Key points:
- Use structured output markers (ACTION:, DIALOGUE:, etc.) for reliable parsing
- Keep system prompt concise; put all context in user message
- Temperature 0.1-0.3 for consistent behavior; 0.5+ for creativity
- Limit history to recent events to avoid token bloat
- Always provide fallback for parsing failures
