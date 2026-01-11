/**
 * Setup Screen Logic
 * Handles player profile creation and storage
 */

export class SetupManager {
    constructor(startCallback) {
        this.startCallback = startCallback;
        this.elements = {
            screen: document.getElementById('setup-screen'),
            form: document.getElementById('setup-form'),
            nameInput: document.getElementById('npc-name'),
            personalityInput: document.getElementById('npc-personality'),
            moodInput: document.getElementById('npc-mood'), // Select
            submitBtn: document.getElementById('start-btn')
        };
    }

    init() {
        // Check if player data exists
        const savedData = localStorage.getItem('my_npc_data');
        if (savedData) {
            // Auto-fill or skip? For now, let's just pre-fill to allow editing
            try {
                const data = JSON.parse(savedData);
                this.elements.nameInput.value = data.name || '';
                this.elements.personalityInput.value = data.personality || '';
                this.elements.moodInput.value = data.mood || 'calm';
            } catch (e) {
                console.warn("Corrupt local storage data", e);
            }
        }

        this.elements.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    handleSubmit(e) {
        e.preventDefault();

        const name = this.elements.nameInput.value.trim();
        const personality = this.elements.personalityInput.value.trim();
        const mood = this.elements.moodInput.value;

        if (!name || !personality) {
            alert("Veuillez remplir tous les champs !");
            return;
        }

        const playerData = {
            id: 'player_' + Date.now(),
            name: name,
            personality: personality,
            mood: mood,
            isPlayer: true, // Marker to identify this is the user's avatar
            startX: 400 + (Math.random() * 100 - 50),
            startY: 300 + (Math.random() * 100 - 50),
            color: '#2ECC71', // Player color (Green)
            radius: 20,
            speed: 50
        };

        // Save to local storage
        localStorage.setItem('my_npc_data', JSON.stringify(playerData));

        // Hide screen
        this.elements.screen.style.display = 'none';

        // Start game
        if (this.startCallback) {
            this.startCallback(playerData);
        }
    }

    show() {
        this.elements.screen.style.display = 'flex';
    }
}
