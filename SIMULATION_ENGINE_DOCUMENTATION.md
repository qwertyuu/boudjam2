# Simulation Canvas 2D - Documentation Complète

## Vue d'ensemble

Cette documentation explique le fonctionnement complet de la simulation autonome RPG basée sur canvas 2D, conçue pour être réimplémentée dans un game engine (Unity, Godot, Unreal, etc.).

**Objectif** : Créer un monde vivant où les NPCs autonomes interagissent via dialogue généré par IA, avec mouvement physique et événements contextuels.

---

## 1. Architecture Générale

### 1.1 Couches de la Simulation

```
┌─────────────────────────────────────────────────────┐
│         INTERFACE UTILISATEUR (UI & Canvas)         │
│  [CONTRAT] ← Données de rendu, event log           │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              BOUCLE DE JEU (Game Loop)              │
│  [CONTRAT] ← Orchestration des systèmes            │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│            SYSTÈMES DE SIMULATION (Black Boxes)    │
│  - Movement  │ Event Detection  │ AI Response       │
│  [CONTRATS d'I/O définis]                           │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│           ENTITÉS & ÉTAT (Characters)              │
│  [Interfaces publiques d'accès]                     │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│        PERSISTANCE & SYNCHRONISATION                │
│  [CONTRATS] ← localStorage, WebSocket, Timeline     │
└─────────────────────────────────────────────────────┘
```

### 1.2 Modules Clés & Contrats

| Module | Fichier | Interface d'Entrée | Interface de Sortie |
|--------|---------|-------------------|-------------------|
| **Game Controller** | `game.js` | Événements UI, DeltaTime | Canvas rendering, logs |
| **Character System** | `npc.js` | Position, state mutations | Position, state queries |
| **Event Generator** | `events.js` | NPC positions, timeline | Event queue |
| **AI System** | `gameAI.js` | Event context, NPC data | Response (dialogue/mood) |
| **Network Manager** | `network.js` | Player state, events | WebSocket messages |
| **UI Renderer** | `streaming_ui.js` | Token stream | Display on DOM |

---

## 2. Spécifications des I/O (Input/Output)

### 2.1 Sources d'Entrées (INPUTS)

#### **A. Données de Joueur (Setup)**
```javascript
// Source: localStorage, formulaire setup
PlayerData {
  name: string,           // "Alice"
  personality: string,    // "curieuse et aventurière"
  mood: string,          // "optimiste", "triste", "neutre"
  color: hex,            // "#FF6B9D" (couleur du cercle)
  startX: number,        // Position initiale X
  startY: number         // Position initiale Y
}
```

**Quand** : Au démarrage du jeu (une seule fois)
**Source** : Utilisateur via SetupManager
**Stockage** : localStorage sous clé `'my_npc_data'`

#### **B. État du Canvas**
```javascript
Canvas {
  width: number,         // Calculé dynamiquement
  height: number,        // Calculé dynamiquement
  context: CanvasRenderingContext2D
}
```

**Quand** : À chaque redimensionnement de fenêtre
**Source** : `window.innerWidth/Height` et resize events
**Mise à jour** : `resizeCanvas()` dans game.js

#### **C. Événements Utilisateur (UI)**
```javascript
UIEvents {
  pause: boolean,        // Bouton pause/play
  reset: boolean,        // Réinitialiser jeu
  editCharacter: {       // Modal d'édition
    name: string,
    personality: string,
    mood: string
  },
  clearChat: boolean     // Effacer historique
}
```

**Quand** : À la discrétion de l'utilisateur
**Source** : Boutons HTML et formulaires
**Gestionnaire** : Event listeners dans `game.js:setupEventListeners()`

#### **D. Horloge Système**
```javascript
Time {
  deltaTime: number,     // Temps écoulé depuis frame précédente (ms)
  currentTime: number,   // performance.now()
  frameCount: number     // Frame numéro depuis démarrage
}
```

**Quand** : À chaque `requestAnimationFrame()`
**Source** : Navigateur
**Format** : Millisecondes depuis démarrage du processus

#### **E. Réseau (Multiplayer)**
```javascript
WebSocketMessage {
  type: 'player_state' | 'dialogue' | 'action',
  playerId: string,
  position: {x, y},
  velocity: {vx, vy},
  dialogue: string,
  action: string,
  mood: string,
  timestamp: number
}
```

**Quand** : ~10 fois par seconde (UPDATE_INTERVAL: 100ms)
**Source** : WebSocket `wss://boudjam2wss.raphaelcote.com`
**Direction** : Bidirectionnel

---

### 2.2 Sorties de Données (OUTPUTS)

#### **A. Rendu Canvas (Visuel)**
```
┌─────────────────────────────────────────────┐
│ - Fond noir (#2C3E50)                      │
│ - Grille de fond (lignes grises)           │
│ - NPCs (cercles colorés)                   │
│   - Outline noir = idle                    │
│   - Outline doré = talking                 │
│   - Outline bleu = thinking                │
│ - Speech bubbles (texte dialogue)          │
│ - Thought bubbles (texte pensée)           │
│ - Action text (texte d'action)             │
│ - Mood emoji au-dessus du NPC             │
│ - Movement arrow (flèche de direction)     │
│ - Performance stats (FPS, TTFT, TPS)       │
└─────────────────────────────────────────────┘
```

**Où** : Element canvas HTML
**Fréquence** : 20 FPS (tous les 50ms)
**Fonction** : `render()` dans game.js:1028-1313

#### **B. Log d'Événements (Sidebar)**
```javascript
EventLogEntry {
  timestamp: number,
  text: string,          // "Alice découvre un cristal brillant"
  type: 'dialogue' | 'action' | 'event',
  speaker: string        // Nom du NPC
}
```

**Où** : DOM element `#event-log-content`
**Format** : Liste HTML (dernier en haut)
**Limite** : 20 entrées maximum
**Mise à jour** : Quand événement généré

#### **C. Timeline Partagée (Contexte)**
```javascript
SharedTimeline = [
  {
    timestamp: number,
    npc: string,
    type: 'dialogue' | 'action' | 'thought',
    content: string,
    context: string
  }
]
```

**Où** : Mémoire (`chatState.sharedTimeline`)
**Utilisé par** : AI pour contexte de réponse
**Limite** : 50 événements
**Accès** : Lecture/écriture du moteur d'événements et du moteur IA

#### **D. Données Réseau (WebSocket)**
```javascript
OutgoingMessage {
  type: 'sync',
  playerId: string,
  playerData: {
    x: number,
    y: number,
    vx: number,
    vy: number,
    currentDialogue: string,
    currentAction: string,
    mood: string,
    name: string,
    color: string
  }
}
```

**Où** : WebSocket vers serveur
**Fréquence** : 10 messages/sec
**Gestionnaire** : `NetworkManager` dans network.js

#### **E. État Persistent (localStorage)**
```javascript
localStorage {
  'my_npc_data': JSON.stringify(playerData),
  'chat_history': JSON.stringify(chatHistory)
}
```

**Où** : localStorage du navigateur
**Vie** : Persistant entre sessions
**Mise à jour** : Après création personnage, réinitialisation

#### **F. Feedback Streaming (UI Temps Réel)**
```javascript
StreamingOutput {
  token: string,         // Un mot ou fragment
  fullText: string,      // Texte accumulé
  isComplete: boolean,
  metadata: {
    ttft: number,        // Time To First Token (ms)
    tps: number          // Tokens Per Second
  }
}
```

**Où** : Panel inférieur du jeu (#streaming-container)
**Fréquence** : À chaque token généré par le modèle IA
**Affichage** : Streaming text effect

---

## 3. Cycle de Simulation Détaillé

### 3.1 Initialisation (Startup)

```
1. Window Load
   ├─ Load game.html
   ├─ Init DOM elements
   └─ Call game.init()

2. game.init()
   ├─ Get canvas reference (2D context)
   ├─ Setup event listeners
   ├─ Check WebGPU support
   ├─ Create SetupManager
   ├─ Check localStorage for saved player data
   │  ├─ If found → startGame(savedData)
   │  └─ If not found → Show setup screen
   └─ Load AI model in background

3. startGame(playerData)
   ├─ Hide setup screen
   ├─ Show loading message
   ├─ initializeWorld(playerData)
   │  ├─ Create playerNPC with playerData
   │  ├─ Initialize empty NPC list (player-only initially)
   │  ├─ Initialize EventGenerator
   │  ├─ Clear event queue and timeline
   │  └─ Setup NetworkManager
   ├─ Show game container
   ├─ resizeCanvas()
   ├─ Set isInGame = true
   └─ Start game loop with requestAnimationFrame()
```

**Durée** : ~2-5 secondes (dépend du download du modèle IA)
**Checkpoint** : `isModelLoaded` et `isInGame` flags

### 3.2 Boucle de Jeu (Game Loop) - Contrat d'Orchestration

**Fréquence** : 20 FPS (50ms par frame)

```
requestAnimationFrame(gameLoop)
│
├─ INPUT PHASE
│  ├─ DeltaTime depuis frame précédente
│  ├─ Événements utilisateur (UI)
│  └─ Messages réseau (WebSocket)
│
├─ SYSTEMS UPDATE (ordre important)
│  ├─ Movement System
│  │  INPUT:  NPC list, deltaTime
│  │  OUTPUT: Updated positions, velocities
│  │
│  ├─ Dialogue System
│  │  INPUT:  NPC list, deltaTime
│  │  OUTPUT: Updated dialogue timers
│  │
│  ├─ Event Detection System
│  │  INPUT:  NPC list, shared timeline
│  │  OUTPUT: Event queue
│  │
│  ├─ AI Response System (async)
│  │  INPUT:  Event queue
│  │  OUTPUT: NPC state mutations (dialogue, mood, action)
│  │
│  └─ Network Broadcast
│     INPUT:  NPC state
│     OUTPUT: WebSocket message
│
├─ RENDERING PHASE
│  INPUT:  NPC list, timelines, UI state
│  OUTPUT: Canvas pixels, DOM updates
│
└─ Schedule next frame
   └─ requestAnimationFrame(gameLoop)
```

**Contraintes** :
- Target: 20 FPS = 50ms par frame
- AI generation est non-bloquante (async)
- Les systèmes ne doivent pas avoir de dépendances circulaires

### 3.3 Système d'Événements - Contrat d'Interface

**Types d'Événements détectés** :
- **ENCOUNTER** : Deux NPCs se rencontrent (proximité < 100px, cooldown 10sec)
- **DISCOVERY** : Un NPC découvre quelque chose (0.1% chance/frame, idle)
- **WORLD_EVENT** : Événement environnemental (tous les 60 sec)
- **OBSERVATION** : NPC réfléchit sur lui-même (0.1% chance/frame)
- **RESPONSE** : NPC répond à un autre NPC

**Contrat Event Generator**:
```javascript
// INPUT
checkEvents(npcs: NPC[], sharedTimeline: Event[]): Event[] {
  // Détecte tous les événements déclenchés ce frame
  // Retourne liste d'événements (peut être vide)
}

// OUTPUT
Event {
  type: string,              // ENCOUNTER | DISCOVERY | etc.
  participants: NPC[],       // NPCs impliqués
  context: string,           // Description du contexte
  timestamp: number          // Quand c'est arrivé
}
```

**Contrat AI Response Generator**:
```javascript
// INPUT
async generateResponse(event: Event, npc: NPC, sharedContext: string): Promise {
  // Prend un événement et un NPC
  // Génère une réponse personnalisée
}

// OUTPUT
Response {
  dialogue: string,          // Texte parlé (affiché dans bubble)
  thought: string,           // Pensée interne (thought bubble)
  action: string,            // Action physique
  mood: string               // Nouvel état émotionnel
}
```

**Contrat Event Queue**:
```javascript
// Files d'attente gérées
maxQueueSize: 10             // Limite pour éviter l'overflow
maxTimelineLength: 50        // Historique partagé (FIFO)
maxLogEntries: 20            // Affichage UI (FIFO)
```

---

## 4. Système de Mouvement - Contrat d'Interface

**Contrat Movement System**:
```javascript
// INPUT
updateMovement(npcs: NPC[], deltaTime: number, worldBounds: Rect) {
  // Reçoit liste de NPCs et temps écoulé
  // Modifie position/vélocité in-place
}

NPC movement {
  x: number,              // Position X
  y: number,              // Position Y
  vx: number,             // Vélocité X (pixels/sec)
  vy: number,             // Vélocité Y (pixels/sec)
  speed: number = 50,     // Vitesse de déplacement
  isRemote: boolean       // Dérive de joueur distant?
}

// OUTPUT (mutations sur NPC)
npc.x += vx * deltaTime
npc.y += vy * deltaTime
npc.activity = 'walking' | 'idle'  // Basé sur mouvement
```

**Comportement**:
- **Local NPC** : Sélection aléatoire de cible (1% chance/frame), mouvement vers cible
- **Remote NPC** : Dead reckoning basé sur vélocité reçue du réseau
- **Collision** : Clamping aux limites du monde (margin 40px)
- **Inactivité** : Après atteinte de cible, pause ~10-30 sec avant nouvelle cible

---

## 5. Système d'IA - Contrat d'Interface

**Contrat AI System**:
```javascript
// INPUT
async generateResponse(event: Event, npc: NPC, recentContext: string): Promise {
  // Reçoit un événement, NPC impliqué, et contexte récent
  // Génère réponse asynchrone (non-bloquante)
}

// OUTPUT
Response {
  dialogue: string,      // Texte à afficher (speech bubble)
  thought: string,       // Pensée interne (thought bubble)
  action: string,        // Action physique
  mood: string           // Nouvel état émotionnel
}

// Avec streaming (callbacks pour token-by-token)
onProgress?: (token: string, fullText: string, metrics: {ttft, tps}) => void
```

**Paramètres de Génération**:
- **Model** : `mistralai/Ministral-3-3B-Instruct-2512-ONNX` (quantized)
- **Temperature** : 0.3 (réponses consistantes)
- **Max tokens** : 150 par réponse
- **Format** : JSON avec tags `DIALOGUE:`, `PENSÉE:`, `ACTION:`, `MOOD:`

**Métadonnées de Performance**:
- **TTFT** (Time To First Token) : ~1-3 sec (dépend GPU)
- **TPS** (Tokens Per Second) : ~5-15 tokens/sec sur WebGPU

---

## 6. Système de Rendu - Contrat d'Interface

**Contrat Rendering System**:
```javascript
// INPUT
render(npcs: NPC[], timelines: Event[], uiState: UIState, canvas: Canvas2D) {
  // Reçoit état complet du jeu
  // Dessine tout sur le canvas
}

// OUTPUT
Canvas display:
- Background (#2C3E50) + grid
- NPC circles (couleur unique)
  - Outline noir (idle) | or (talking) | bleu (thinking)
- Mood emoji au-dessus
- Speech bubble si dialogue actif
- Thought bubble si pensée active
- Action text sous NPC
- Movement arrow si en mouvement
- Performance stats (FPS, TTFT, TPS)
```

**Couches de Rendu (ordre)**:
1. Fond + grille
2. Cercles NPC + outlines
3. Bubbles (speech + thought)
4. Texte d'action
5. Emoji mood
6. Flèches de direction
7. Stats (overlay)

**Fréquence** : 20 FPS cible (50ms/frame)

**Optimisations**:
- Clear/redraw complet à chaque frame
- Batch draw operations (beginPath/stroke)
- Réuse de valeurs calculées
- Early exit si texte expiré

---

## 7. Contrats Système à Système (Inter-System Contracts)

### 7.1 Game Loop ↔ Movement System

```javascript
INTERFACE {
  // Game Loop calls
  updateMovement(npcs: NPC[], deltaTime: number, bounds: Rect) → void

  // Movement System modifies NPC in-place:
  npc.x, npc.y, npc.vx, npc.vy, npc.activity
}
```

### 7.2 Game Loop ↔ Event Generator

```javascript
INTERFACE {
  // Game Loop calls
  checkEvents(npcs: NPC[], timeline: Event[]) → Event[]

  // Returns new events detected this frame
  Event {
    type: 'ENCOUNTER' | 'DISCOVERY' | 'WORLD_EVENT' | 'OBSERVATION'
    participants: NPC[]
    context: string
    timestamp: number
  }
}
```

### 7.3 Event Queue ↔ AI System

```javascript
INTERFACE {
  // Event processor calls (async)
  generateResponse(event: Event, npc: NPC, contextString: string) → Promise<Response>

  // Returns structured response
  Response {
    dialogue: string
    thought: string
    action: string
    mood: string
  }

  // With optional streaming callback
  onProgress: (token: string, fullText: string, {ttft, tps}) → void
}
```

### 7.4 AI System ↔ NPC State

```javascript
INTERFACE {
  // AI mutations on NPC
  npc.setDialogue(text: string, duration: number) → void
  npc.setThought(text: string, duration: number) → void
  npc.setAction(text: string, duration: number) → void
  npc.mood = 'happy' | 'sad' | 'thinking' | ...
  npc.lastInteractionTime = timestamp
}
```

### 7.5 Game Loop ↔ Rendering System

```javascript
INTERFACE {
  // Game Loop calls every frame
  render(npcs: NPC[], events: Event[], uiState) → void

  // Renders to canvas:
  // - NPC circles with mood emoji
  // - Speech/thought bubbles
  // - Movement indicators
  // - Performance metrics overlay
}
```

### 7.6 Game Loop ↔ Network Manager

```javascript
INTERFACE {
  // Game Loop calls periodically (~100ms)
  broadcast(playerData: {x, y, vx, vy, dialogue, mood}) → void

  // Network Manager receives (async)
  onRemoteUpdate(message: {playerId, playerData, timestamp}) → void
    // Updates remote NPC position/state

  onPlayerJoined(playerId: string, playerData: object) → void
    // Creates new remote NPC in world

  onPlayerLeft(playerId: string) → void
    // Removes NPC from world
}
```

### 7.7 Timeline Shared (Lecture-Seule pour IA)

```javascript
INTERFACE {
  sharedTimeline: Event[] {
    timestamp: number
    npc: string
    type: 'dialogue' | 'action' | 'thought'
    content: string
    context: string
  }

  // Max 50 events (FIFO when exceeded)
  // AI reads last ~10 for context
  // Event Queue writes new events
}
```

### 7.8 Event Log (UI - Lecture-Seule)

```javascript
INTERFACE {
  eventLog: LogEntry[] {
    timestamp: number
    speaker: string (NPC name or "System")
    type: 'dialogue' | 'action' | 'event'
    content: string
    mood?: string
  }

  // Max 20 entries (FIFO when exceeded)
  // UI renders in sidebar
  // Event Queue writes entries
}
```

---

## 8. Persistance & Stockage (Persistence)

### 8.1 localStorage

```javascript
// Clés principales
localStorage {
  'my_npc_data': string,
    // Contenu: JSON.stringify({name, personality, mood, color, startX, startY})
    // Vie: Persistant entre sessions
    // Mis à jour: Après setup, après édition
    // Utilisé: Au démarrage pour récharger le joueur

  'chat_history': string,
    // Contenu: JSON.stringify([messages])
    // Vie: Persistant
    // Utilisé: Interface chat partagée (index.html)
}
```

### 8.2 IndexedDB (Cache Model)

**Code source** : `cache.js`

```javascript
// Structure
cacheDB {
  stores: {
    'cache': {
      keys: [
        'model_loaded_timestamp',
        'model_id',
        'model_weights_[hash]',
        'model_config_[hash]'
      ]
    }
  }
}

// Optimisation
checkModelCache()
  └─ If model cached and recent
     └─ Load from IndexedDB (faster)
     └─ Vs: Download from CDN (slower)
```

### 8.3 Partage d'État (Shared State)

```javascript
// chatState (shared between game.js and app.js)
chatState {
  processor: null,           // Shared processor instance
  model: null,              // Shared model instance
  messages: [],             // Shared chat history
  isGenerating: false       // Generation lock
}

// Imported par:
// - gameAI.js (pour NPC responses)
// - game.js (pour rendu et événements)
// - app.js (pour chat interface)
```

---

## 9. Système Réseau (Networking)

### 9.1 Architecture WebSocket

**Code source** : `network.js`

```
Client (Browser)                    Server (WebSocket)
     │                                    │
     ├─ Connect                           │
     │  WebSocket("wss://...")    ──────▶ Receive
     │                                    │
     ├─ Player joins                      │
     │  {playerId, playerData}    ──────▶ Broadcast to all
     │                                    │
     ├─ Position update (10x/sec)        │
     │  {type, position, velocity} ──────▶ Forward to others
     │  Delta time: ~100ms                │
     │                                    │
     ├─ Receive remote updates           ◀─ Incoming position
     │                                    │
     ├─ Draw remote NPCs                 │
     │  Position, velocity, dialogue     │
     │                                    │
     └─ Disconnect                        │
        {playerId}              ──────▶ Remove from world
```

### 9.2 Message Format

**Outgoing** (from this client):

```javascript
{
  type: 'sync',
  playerId: string,
  playerData: {
    x: number,
    y: number,
    vx: number,
    vy: number,
    currentDialogue: string | null,
    currentAction: string | null,
    mood: string,
    name: string,
    color: string
  }
}
```

**Incoming** (from remote players):

```javascript
{
  type: 'player_joined' | 'player_update' | 'player_left' | 'dialogue',
  playerId: string,
  playerData: {...},
  timestamp: number
}
```

### 9.3 Update Frequency

```
UPDATE_INTERVAL = 100ms  // 10 updates per second

Timer:
├─ setInterval(broadcast, UPDATE_INTERVAL)
│  └─ Send position every 100ms
│
└─ Rationale:
   ├─ 10 updates/sec = smooth visual (no jank)
   ├─ Bandwidth: ~100 bytes * 10/sec = 1KB/sec per player
   └─ Network traffic manageable
```

---

## 10. Interface Utilisateur (UI System)

### 10.1 DOM Structure

```html
<div id="game-container">
  <!-- Canvas -->
  <canvas id="game-canvas"></canvas>

  <!-- Sidebars -->
  <div id="event-log">
    <div id="event-log-content">
      <!-- Event entries added dynamically -->
    </div>
  </div>

  <div id="ai-sidebar">
    <div id="streaming-container">
      <!-- Real-time AI token display -->
    </div>
  </div>

  <!-- Controls -->
  <button id="pause-btn">Pause</button>
  <button id="reset-btn">Reset</button>
  <button id="edit-character-btn">Edit Character</button>

  <!-- Modals -->
  <div id="edit-character-modal">
    <form id="edit-character-form">
      <input id="edit-name" />
      <input id="edit-personality" />
      <input id="edit-mood" />
      <button type="submit">Save</button>
      <button type="button" id="cancel-edit-btn">Cancel</button>
    </form>
  </div>
</div>
```

### 10.2 Event Log

```javascript
EventLogEntry {
  // Displayed as:
  // "[18:34:22] Alice: 'Bonjour Bob!'"
  // or
  // "[18:34:30] System: 'A meteor streaks across the sky'"

  timestamp: number,      // ms since epoch
  speaker: string,        // NPC name or "System"
  type: 'dialogue' | 'action' | 'event',
  content: string,        // The actual text
  mood?: string          // Optional mood emoji
}

// Max entries: 20 (FIFO queue)
// Display: Most recent at top
// Update: Real-time as events process
```

### 10.3 Streaming UI

**Code source** : `streaming_ui.js`

```javascript
StreamingUI {
  displayToken(token) {
    // Append token to #streaming-container
    // Format: word-by-word with slight delay
    // Auto-scroll to bottom
    // Update stats (TTFT, TPS)
  },

  clear() {
    // Clear all text
    // Reset stats
  },

  displayStats(ttft, tps) {
    // Show: "TTFT: 1234ms | TPS: 8.5"
  }
}
```

---

## 11. Checklist de Réimplémentation (Game Engine)

### 11.1 Core Systems

```
☐ Character System
  ☐ NPC class with identity (name, personality, mood)
  ☐ Position & velocity (x, y, vx, vy)
  ☐ Activity state machine (idle, walking, talking, thinking)
  ☐ Dialogue/thought/action buffers with timers

☐ Movement System
  ☐ Random target selection (1% chance per frame)
  ☐ Linear movement towards target (50 px/sec)
  ☐ Boundary collision (clamping to world bounds)
  ☐ Dead reckoning for remote players

☐ Event System
  ☐ Proximity detection (100px threshold)
  ☐ Discovery events (0.1% chance per frame)
  ☐ World events (60-second intervals)
  ☐ Observation events (0.1% chance per frame)
  ☐ Event queue with max size limit
  ☐ Response event (NPC-to-NPC interaction)

☐ AI Integration
  ☐ Load LLM model (or connect to API)
  ☐ Build system prompt with context
  ☐ Generate responses with streaming
  ☐ Parse JSON with tag extraction (DIALOGUE, PENSÉE, ACTION, MOOD)
  ☐ Update NPC state from AI response

☐ Render System
  ☐ Canvas/texture rendering loop (20 FPS target)
  ☐ NPC circle + outline (color based on activity)
  ☐ Speech/thought bubbles with text wrapping
  ☐ Action text below NPC
  ☐ Mood emoji above NPC
  ☐ Movement arrows for walking NPCs
  ☐ Performance stats overlay
```

### 11.2 I/O Integration Points

```
INPUT INTERFACES:
☐ Player Setup
  ☐ Name, personality, mood inputs
  ☐ Persist to localStorage/save file

☐ Canvas Events
  ☐ Window resize → recalculate bounds
  ☐ Pause/Play button
  ☐ Reset world button
  ☐ Edit character modal

☐ Network (if multiplayer)
  ☐ WebSocket connection to server
  ☐ Broadcast player state every 100ms
  ☐ Receive remote player updates

☐ Time Input
  ☐ DeltaTime from game engine
  ☐ Frame timing for physics

OUTPUT INTERFACES:
☐ Canvas Rendering
  ☐ Draw NPCs, dialogues, actions
  ☐ Render at consistent frame rate

☐ Event Logging
  ☐ Display events in UI panel
  ☐ Max 20 entries (FIFO)

☐ Shared Timeline
  ☐ Maintain 50-event history for AI context

☐ Network Broadcasting
  ☐ Send position/velocity to server
  ☐ Broadcast dialogue to all players

☐ UI Updates
  ☐ Update event log in real-time
  ☐ Display streaming AI tokens
  ☐ Show performance metrics

☐ Persistence
  ☐ Save player data to disk
  ☐ Load previous characters
```

### 11.3 Architecture Template

```csharp
// Pseudo-code for game engine implementation

class SimulationEngine {
  // Core components
  List<NPC> npcs;
  NPC playerCharacter;
  EventGenerator eventGenerator;
  AISystem aiSystem;
  NetworkManager networkManager;

  // State
  Queue<Event> eventQueue;
  List<TimelineEntry> sharedTimeline;
  float deltaTime;

  // Configuration
  const int TARGET_FPS = 20;
  const float FRAME_TIME = 1000f / 20f;
  const int PROXIMITY_THRESHOLD = 100;
  const float DISCOVERY_CHANCE = 0.001f;

  // Main loop
  void GameLoop() {
    while (running) {
      // 1. Update phase
      UpdateMovement();
      UpdateDialogues();
      CheckAndProcessEvents();
      ProcessEventQueue();

      // 2. Render phase
      Render();

      // 3. Network phase (if enabled)
      networkManager.Broadcast();

      // 4. Timing
      WaitForTargetFrameRate();
    }
  }

  void UpdateMovement() {
    foreach (var npc in npcs) {
      if (npc.isRemote) {
        // Dead reckoning
        npc.x += npc.vx * deltaTime;
        npc.y += npc.vy * deltaTime;
      } else {
        // Local AI movement
        npc.UpdateMovement(deltaTime);
      }
    }
  }

  void CheckAndProcessEvents() {
    var newEvents = new List<Event>();
    newEvents.AddRange(eventGenerator.CheckProximityEvents(npcs));
    newEvents.AddRange(eventGenerator.CheckDiscoveryEvents(npcs));
    newEvents.AddRange(eventGenerator.CheckWorldEvents());
    newEvents.AddRange(eventGenerator.CheckObservationEvents(npcs));

    eventQueue.Enqueue(newEvents);
  }

  async void ProcessEventQueue() {
    while (eventQueue.Count > 0 && !isProcessingEvent) {
      var evt = eventQueue.Dequeue();

      // Generate AI response
      var response = await aiSystem.GenerateResponse(evt);

      // Update NPC state
      foreach (var npc in evt.Participants) {
        npc.SetDialogue(response.dialogue, 10000);
        npc.SetThought(response.thought, 5000);
        npc.SetAction(response.action, 6000);
        npc.mood = response.mood;
      }

      // Add to shared timeline
      sharedTimeline.Add(new TimelineEntry {
        timestamp = Time.now,
        npc = npc.name,
        type = response.type,
        content = response.content
      });

      // Add to UI event log
      uiManager.AddEventLog(response);
    }
  }

  void Render() {
    canvas.Clear("#2C3E50");
    canvas.DrawGrid();

    foreach (var npc in npcs) {
      DrawNPC(npc);
      if (npc.currentDialogue) DrawSpeechBubble(npc);
      if (npc.currentAction) DrawActionText(npc);
      if (npc.currentThought) DrawThoughtBubble(npc);
    }

    canvas.Present();
  }
}
```

---

## 12. Performance Considerations

### 12.1 Bottlenecks Identifiés

| Bottleneck | Cause | Impact | Mitigation |
|-----------|-------|--------|-----------|
| **AI Generation** | LLM inference | 2-10 sec block per event | Queue events, stream tokens |
| **Canvas Rendering** | Text layout | 20 FPS target | Reduce FPS, batch draws |
| **Event Detection** | O(n²) proximity check | Scales with NPC count | Spatial partitioning |
| **Model Loading** | CDN download | 2-5 sec startup | Load in background, cache |
| **Memory** | LLM weights in VRAM | Browser memory limit | Use quantization (q4/fp16) |

### 12.2 Optimisations Appliquées

```javascript
// 1. Reduced FPS
targetFPS = 20  // From 60, saves 66% CPU

// 2. Event queue limiting
MAX_QUEUE_SIZE = 10  // Prevent overflow

// 3. Timeline capping
MAX_TIMELINE_LENGTH = 50  // FIFO queue

// 4. Event log capping
MAX_LOG_ENTRIES = 20  // UI performance

// 5. Model quantization
dtype: {
  embed_tokens: 'fp16',          // 50% memory
  vision_encoder: 'q4',          // 75% reduction
  decoder_model_merged: 'q4f16'  // Balanced
}

// 6. Shared state reuse
chatState (shared between modules)  // Avoid double-loading model

// 7. Busy state checking
if (npc.isBusy()) skip_event_processing  // Prevent interference
```

### 12.3 Recommandations pour Game Engine

```
Performance Budget (per frame @ 20 FPS = 50ms):
├─ Movement update: 1-2ms (n NPCs)
├─ Event detection: 2-3ms (O(n²) in worst case)
├─ Dialogue update: 0.5ms (n NPCs)
├─ AI generation: 0ms (async, non-blocking)
├─ Rendering: 10-15ms (canvas draw)
├─ UI update: 1-2ms (DOM manipulation)
└─ Network: 1ms (batched)

Total: ~16-25ms per frame (below 50ms target)

If exceeds budget:
1. Profile with performance tools
2. Reduce NPC count or event frequency
3. Implement spatial partitioning (quadtree)
4. Use GPU rendering (WebGL, Metal, etc.)
5. Async AI processing (separate thread/worker)
```

---

## 13. Exemples d'Intégration

### 13.1 Minimal Game Engine Integration

**Pseudo-code** pour Godot/Unity:

```
# Godot GDScript example
extends Node2D

class_name GameSimulation

var npcs: Array = []
var player_npc: NPC
var event_queue: Array = []
var shared_timeline: Array = []
var ai_system: AISystem
var event_generator: EventGenerator

const TARGET_FPS = 20
const FRAME_TIME = 1000.0 / TARGET_FPS

func _ready():
  player_npc = setup_player_character()
  event_generator = EventGenerator.new(self)
  ai_system = AISystem.new()
  _process_timer = 0

func _process(delta):
  _process_timer += delta * 1000  # Convert to ms

  if _process_timer < FRAME_TIME:
    return

  # Update phase
  update_movement(_process_timer)
  update_dialogues(_process_timer)
  check_and_process_events()
  await process_event_queue()

  # Render phase
  queue_redraw()

  _process_timer = 0

func update_movement(delta):
  for npc in npcs:
    npc.update_movement(delta)

  broadcast_to_network()

func check_and_process_events():
  var new_events = []
  new_events += event_generator.check_proximity_events(npcs)
  new_events += event_generator.check_discovery_events(npcs)
  new_events += event_generator.check_world_events()
  new_events += event_generator.check_observation_events(npcs)

  for evt in new_events:
    event_queue.append(evt)

func process_event_queue():
  while event_queue.size() > 0:
    var evt = event_queue.pop_front()
    var response = await ai_system.generate_response(evt)

    # Update NPC state
    for npc in evt.participants:
      npc.set_dialogue(response.dialogue, 10000)
      npc.set_action(response.action, 6000)
      npc.mood = response.mood

    # Timeline + UI
    shared_timeline.append(response)
    ui_manager.add_event_log(response)

    await get_tree().create_timer(0.1).timeout  # Small delay

func _draw():
  # Clear
  draw_rect(Rect2(0, 0, get_viewport().size), Color("#2C3E50"))

  # NPCs
  for npc in npcs:
    draw_npc(npc)
```

### 13.2 Unity C# Integration

```csharp
using UnityEngine;
using System.Collections.Generic;

public class GameSimulation : MonoBehaviour {
  private List<NPC> npcs = new List<NPC>();
  private NPC playerCharacter;
  private Queue<GameEvent> eventQueue = new Queue<GameEvent>();
  private AISystem aiSystem;
  private EventGenerator eventGenerator;

  private const int TARGET_FPS = 20;
  private float frameTime = 1000f / TARGET_FPS;
  private float timeSinceLastFrame = 0;

  void Update() {
    timeSinceLastFrame += Time.deltaTime * 1000;

    if (timeSinceLastFrame < frameTime) {
      return;
    }

    // Simulation tick
    UpdateMovement();
    UpdateDialogues();
    CheckAndProcessEvents();
    StartCoroutine(ProcessEventQueue());

    timeSinceLastFrame = 0;
  }

  void UpdateMovement() {
    foreach (var npc in npcs) {
      npc.UpdateMovement(Time.deltaTime);
    }
  }

  void CheckAndProcessEvents() {
    eventQueue.Enqueue(eventGenerator.CheckProximityEvents(npcs));
    // ... more event checks
  }

  IEnumerator ProcessEventQueue() {
    while (eventQueue.Count > 0) {
      var evt = eventQueue.Dequeue();
      var response = await aiSystem.GenerateResponse(evt);

      foreach (var npc in evt.Participants) {
        npc.SetDialogue(response.Dialogue, 10f);
        npc.SetAction(response.Action, 6f);
        npc.Mood = response.Mood;
      }

      yield return new WaitForSeconds(0.1f);
    }
  }
}
```

---

## 14. Ressources & Références

### 14.1 Dépendances Externes

| Dépendance | Source | Version | Rôle |
|-----------|--------|---------|------|
| **Transformers.js** | `@huggingface/transformers` | 3.8.1+ | Inference LLM |
| **Mistral Model** | Hugging Face | `mistralai/Ministral-3-3B-*-ONNX` | LLM Weights |
| **Canvas API** | Browser Standard | 2D Context | Rendering |
| **WebSocket** | Browser Standard | ws:// / wss:// | Networking |
| **IndexedDB** | Browser Standard | v1+ | Caching |
| **localStorage** | Browser Standard | v1+ | Persistence |

### 14.2 Documentation Externe

- [Canvas 2D MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Transformers.js Docs](https://huggingface.co/docs/transformers.js)
- [WebGPU Spec](https://gpuweb.github.io/gpuweb/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

## 15. Conclusion

Cette documentation fournit une spécification complète de la simulation canvas 2D pour réimplémentation dans un game engine.

### Principes Clés:
1. **Architecture modulaire** - Chaque système peut être implémenté indépendamment
2. **I/O bien définis** - Interfaces claires entre systèmes
3. **Performance optimisée** - 20 FPS target, queue-based event processing
4. **Extensible** - Facile d'ajouter nouveaux types d'événements ou actions
5. **Réseau-aware** - Support multiplayer intégré depuis le départ

### Pour Démarrer:
1. Implémenter le **Character System** (NPC class + mouvement)
2. Implémenter le **Render System** (canvas 2D ou équivalent)
3. Implémenter l'**Event System** (détection d'événements)
4. Intégrer l'**AI System** (appel API ou modèle local)
5. Ajouter le **Network Manager** (si multiplayer désiré)

Bonne chance avec la réimplémentation! 🚀
