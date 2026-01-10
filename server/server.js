const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const players = new Map();

console.log('Server started on port 8080');

wss.on('connection', (ws) => {
    let playerId = null;

    console.log('New client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'JOIN':
                    playerId = data.player.id;
                    players.set(playerId, { ...data.player, ws });

                    // Broadcast new player to others
                    broadcast({
                        type: 'PLAYER_JOINED',
                        player: data.player
                    }, playerId);

                    // Send existing players to new player
                    const existingPlayers = Array.from(players.values())
                        .filter(p => p.id !== playerId)
                        .map(({ ws, ...playerData }) => playerData);

                    if (existingPlayers.length > 0) {
                        ws.send(JSON.stringify({
                            type: 'EXISTING_PLAYERS',
                            players: existingPlayers
                        }));
                    }
                    break;

                case 'UPDATE':
                    if (playerId && players.has(playerId)) {
                        const player = players.get(playerId);
                        // Update state (except ws connection)
                        Object.assign(player, data.state);

                        // Broadcast update to others (lightweight)
                        broadcast({
                            type: 'PLAYER_UPDATE',
                            id: playerId,
                            state: data.state
                        }, playerId);
                    }
                    break;

                case 'EVENT':
                    // Broadcast event (Dialogue, Action)
                    broadcast({
                        type: 'PLAYER_EVENT',
                        id: playerId,
                        event: data.event
                    }, playerId);
                    break;
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    ws.on('close', () => {
        if (playerId) {
            console.log(`Player ${playerId} disconnected`);
            players.delete(playerId);
            broadcast({
                type: 'PLAYER_LEFT',
                id: playerId
            });
        }
    });
});

function broadcast(data, excludeId = null) {
    const message = JSON.stringify(data);
    players.forEach((player) => {
        if (player.id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    });
}
