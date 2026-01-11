/**
 * StreamingUI
 * Handles the visual representation of real-time AI text generation
 */

export class StreamingUI {
    constructor() {
        this.container = document.getElementById('streaming-ui-container');
        this.sourceLabel = document.getElementById('streaming-source');
        this.contentArea = document.getElementById('streaming-content');
        this.indicator = document.querySelector('.typing-indicator');

        this.isVisible = false;
        this.currentText = '';
    }

    /**
     * Show the streaming UI for a specific NPC
     */
    startStream(npcName) {
        this.sourceLabel.textContent = npcName;
        this.sourceLabel.style.color = '#3b82f6'; // Reset color
        this.contentArea.innerHTML = ''; // Clear previous
        this.currentText = '';

        this.show();
        this.indicator.style.display = 'block';
    }

    /**
     * Append a chunk of text to the stream
     */
    appendChunk(chunk) {
        if (!this.isVisible) this.show();

        this.currentText += chunk;

        // Simple heuristic highlighting for tags
        // We re-render the whole text with highlighting (not efficient for huge text but fine here)
        this.renderText();

        // Auto-scroll
        this.contentArea.scrollTop = this.contentArea.scrollHeight;
    }

    /**
     * End the stream session
     */
    endStream() {
        this.indicator.style.display = 'none';

        // Keep visible for a moment then hide, or let user hide?
        // For now, let's keep it visible for a few seconds if it was a short message
        setTimeout(() => {
            // Optional: Hide after delay?
            // this.hide(); 
        }, 5000);
    }

    /**
     * Render text with syntax highlighting for tags
     */
    renderText() {
        // Regex to find tags like ACTION:, DIALOGUE: and wrap them
        // Note: This matches the tag at the start of lines or after newlines mostly
        let formatted = this.currentText
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;'); // Escape HTML

        // Highlight tags
        const tags = [
            { key: 'ACTION:', class: 'tag-action' },
            { key: 'DIALOGUE:', class: 'tag-dialogue' },
            { key: 'PENSÉE:', class: 'tag-thought' },
            { key: 'MOOD:', class: 'tag-mood' }
        ];

        tags.forEach(tag => {
            // Replace "TAG:" with "<span class='...'>TAG:</span>"
            const regex = new RegExp(`(${tag.key})`, 'g');
            formatted = formatted.replace(regex, `<span class="stream-tag ${tag.class}">$1</span>`);
        });

        this.contentArea.innerHTML = formatted;
    }

    show() {
        this.container.classList.remove('hidden');
        // Trigger reflow for animation
        void this.container.offsetWidth;
        this.container.classList.add('active');
        this.isVisible = true;
    }

    hide() {
        this.container.classList.remove('active');
        setTimeout(() => {
            if (!this.container.classList.contains('active')) {
                this.container.classList.add('hidden');
            }
        }, 300); // Match CSS transition
        this.isVisible = false;
    }
}
