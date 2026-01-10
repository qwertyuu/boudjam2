/**
 * Broadcast system for NPC actions across tabs/windows
 * Enables same-browser multiplayer by broadcasting NPC actions and dialogue
 * Uses localStorage events for cross-tab communication
 */

const BROADCAST_CHANNEL = "npc_broadcasts";
const BROADCAST_POLL_INTERVAL = 500;

let broadcastSubscribers = [];
let lastSeenBroadcastId = null;
let pollInterval = null;

function initBroadcastListener() {
  window.addEventListener("storage", (event) => {
    if (event.key === BROADCAST_CHANNEL && event.newValue) {
      try {
        const broadcast = JSON.parse(event.newValue);
        notifySubscribers(broadcast);
      } catch (error) {
        console.error("Error parsing broadcast:", error);
      }
    }
  });
}

function initBroadcastPolling() {
  if (pollInterval) return;

  pollInterval = setInterval(() => {
    try {
      const storedBroadcast = localStorage.getItem(BROADCAST_CHANNEL);
      if (storedBroadcast) {
        const broadcast = JSON.parse(storedBroadcast);

        if (broadcast.id && broadcast.id !== lastSeenBroadcastId) {
          lastSeenBroadcastId = broadcast.id;
          notifySubscribers(broadcast);
        }
      }
    } catch (error) {
      console.error("Error in broadcast polling:", error);
    }
  }, BROADCAST_POLL_INTERVAL);
}

function stopBroadcastPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function notifySubscribers(broadcast) {
  broadcastSubscribers.forEach((callback) => {
    try {
      callback(broadcast);
    } catch (error) {
      console.error("Error in broadcast subscriber:", error);
    }
  });
}

export function broadcastAction(npcId, action, dialogue = "", additionalData = {}) {
  const broadcast = {
    id: generateBroadcastId(),
    timestamp: Date.now(),
    npcId: npcId,
    action: action,
    dialogue: dialogue,
    ...additionalData,
  };

  try {
    localStorage.setItem(BROADCAST_CHANNEL, JSON.stringify(broadcast));
    notifySubscribers(broadcast);
    console.log(`[Broadcast] NPC ${npcId}: ${action}${dialogue ? ` | "${dialogue}"` : ""}`);
    return broadcast;
  } catch (error) {
    console.error("Error broadcasting action:", error);
    return null;
  }
}

export function subscribeToBroadcasts(callback) {
  if (typeof callback !== "function") {
    console.error("Subscribe callback must be a function");
    return null;
  }

  if (broadcastSubscribers.length === 0) {
    initBroadcastListener();
    initBroadcastPolling();
  }

  broadcastSubscribers.push(callback);

  console.log(`[Broadcast] Subscriber added (total: ${broadcastSubscribers.length})`);

  return () => unsubscribeFromBroadcasts(callback);
}

export function unsubscribeFromBroadcasts(callback) {
  const index = broadcastSubscribers.indexOf(callback);

  if (index !== -1) {
    broadcastSubscribers.splice(index, 1);
    console.log(`[Broadcast] Subscriber removed (total: ${broadcastSubscribers.length})`);
  }

  if (broadcastSubscribers.length === 0) {
    stopBroadcastPolling();
  }
}

function generateBroadcastId() {
  return `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getSubscriberCount() {
  return broadcastSubscribers.length;
}

export function clearBroadcasts() {
  try {
    localStorage.removeItem(BROADCAST_CHANNEL);
    lastSeenBroadcastId = null;
    console.log("[Broadcast] Broadcasts cleared");
  } catch (error) {
    console.error("Error clearing broadcasts:", error);
  }
}

export function getLastBroadcast() {
  try {
    const stored = localStorage.getItem(BROADCAST_CHANNEL);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error("Error getting last broadcast:", error);
    return null;
  }
}

export function getBroadcastStats() {
  return {
    subscribers: broadcastSubscribers.length,
    pollingActive: pollInterval !== null,
    lastBroadcastId: lastSeenBroadcastId,
    pollInterval: BROADCAST_POLL_INTERVAL,
    lastBroadcast: getLastBroadcast(),
  };
}
