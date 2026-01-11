/**
 * Network Manager
 * Handles WebSocket connection and synchronization
 */

export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.isConnected = false;
        this.playerId = null;
        this.updateInterval = null;
        this.remotePlayers = new Map(); // Map<id, NPC>
    }

    connect(playerData) {
        this.playerId = playerData.id;
        this.socket = new WebSocket('ws://localhost:8080');

        this.socket.onopen = () => {
            console.log('Connected to server');
            this.isConnected = true;
            this.game.addEventLogEntry('Network', 'Connected to multiplayer server', 'network-success');

            // Send JOIN message
            this.send('JOIN', { player: playerData });

            // Start update loop (10 times per second)
            this.updateInterval = setInterval(() => this.sendPlayerUpdate(), 100);
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (e) {
                console.error('Error parsing network message:', e);
            }
        };

        this.socket.onclose = () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            this.game.addEventLogEntry('Network', 'Disconnected from server', 'network-error');
            if (this.updateInterval) clearInterval(this.updateInterval);
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.game.addEventLogEntry('Network', 'Connection error', 'network-error');
        };
    }

    send(type, data) {
        if (this.isConnected) {
            this.socket.send(JSON.stringify({ type, ...data }));
        }
    }

    sendPlayerUpdate() {
        if (!this.game.playerNPC) return;

        const nav = this.game.playerNPC;
        const state = {
            x: nav.x,
            y: nav.y,
            vx: nav.vx,
            vy: nav.vy,
            mood: nav.mood,
            activity: nav.currentActivity
        };

        this.send('UPDATE', { state });
    }

    sendEvent(eventType, eventData) {
        this.send('EVENT', {
            event: {
                type: eventType,
                ...eventData
            }
        });
    }

    handleMessage(data) {
        switch (data.type) {
            case 'EXISTING_PLAYERS':
                data.players.forEach(p => this.addRemotePlayer(p));
                break;

            case 'PLAYER_JOINED':
                this.addRemotePlayer(data.player);
                this.game.addEventLogEntry('Network', `${data.player.name} joined the world`, 'join');
                break;

            case 'PLAYER_LEFT':
                this.removeRemotePlayer(data.id);
                break;

            case 'PLAYER_UPDATE':
                this.updateRemotePlayer(data.id, data.state);
                break;

            case 'PLAYER_EVENT':
                this.handleRemoteEvent(data.id, data.event);
                break;
        }
    }

    addRemotePlayer(data) {
        if (this.remotePlayers.has(data.id)) return;
        if (this.playerId && data.id === this.playerId) return;


        // Dynamically import NPC to avoid circular dependency issues if possible, 
        // or assume it's globally available/passed. 
        // Ideally we use the game reference to create NPC.

        // We need to create a visual representation. 
        // We can reuse the NPC class but set it to "remote" mode (no AI)
        import('./npc.js').then(({ NPC }) => {
            const remoteNPC = new NPC({
                id: data.id,
                name: data.name,
                personality: data.personality, // Not strictly needed for remote but good for info
                startX: data.startX,
                startY: data.startY,
                color: data.color,
                radius: data.radius,
                speed: data.speed
            });

            remoteNPC.isRemote = true; // Flag to disable local AI updates if needed
            remoteNPC.mood = data.mood;

            this.remotePlayers.set(data.id, remoteNPC);
            this.game.npcs.push(remoteNPC);
        });
    }

    removeRemotePlayer(id) {
        if (this.remotePlayers.has(id)) {
            const npc = this.remotePlayers.get(id);
            this.game.npcs = this.game.npcs.filter(n => n.id !== id);
            this.remotePlayers.delete(id);
            this.game.addEventLogEntry('Network', `${npc.name} left the world`, 'leave');
        }
    }

    updateRemotePlayer(id, state) {
        const npc = this.remotePlayers.get(id);
        if (npc) {
            // Direct position update for now (could interpolate for smoothness)
            npc.x = state.x;
            npc.y = state.y;
            npc.vx = state.vx;
            npc.vy = state.vy;
            npc.mood = state.mood;
            npc.currentActivity = state.activity;
        }
    }

    handleRemoteEvent(id, event) {
        const npc = this.remotePlayers.get(id);
        if (!npc) return;

        if (event.type === 'DIALOGUE' && event.text) {
            npc.setDialogue(event.text, event.duration || 6000);
            this.game.addEventLogEntry('Chat', `${npc.name}: ${event.text}`, 'chat');
        } else if (event.type === 'ACTION' && event.text) {
            npc.setAction(event.text, event.duration || 6000);
            this.game.addEventLogEntry('Action', `${npc.name} ${event.text}`, 'action');
        } else if (event.type === 'WAITING') {
            // Optional: show "..." bubble
        }
    }
}
