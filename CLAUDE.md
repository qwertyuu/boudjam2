# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser-based chat interface that runs the Ministral-3-3B AI model locally using WebGPU. It's a static HTML/JavaScript application with no build process or backend server.

## Getting Started

**Running the Application:**
- Open `index.html` (or `chat.html`) in a modern web browser (Chrome 113+, Edge 113+, or Firefox Nightly with WebGPU enabled)
- Use a local web server if opening locally via `file://` causes issues:
  - VS Code: Install "Live Server" extension and click "Go Live"
  - Python: `python -m http.server 5501`
  - Node: `npx http-server`

**Browser Requirements:**
- WebGPU support is mandatory (Chrome 113+, Edge 113+, or Firefox Nightly)
- The app checks for WebGPU support and displays an error message if unavailable

## Architecture

### File Structure
- `index.html` / `chat.html` - Main chat interface (both are identical)
- `js/app.js` - Application entry point that initializes the app and sets up event listeners
- `js/chat.js` - Core chat functionality including UI rendering, message handling, and AI response generation
- `js/cache.js` - IndexedDB caching utilities for model files (currently exported but not actively used in app.js)
- `css/styles.css` - Styling for the chat interface

### Application Flow

1. **Initialization** (`app.js`):
   - DOM elements are initialized via `initElements()`
   - Event listeners are set up via `setupEventListeners()`
   - Model loading begins via `loadModel()`

2. **Model Loading** (`app.js` - `loadModel()`):
   - Checks WebGPU support
   - Loads the Ministral-3-3B processor and model from Hugging Face CDN
   - Model is quantized (fp16/q4) to fit in browser memory
   - Shows a progress bar during download
   - Displays the chat interface once ready

3. **Chat Flow** (`chat.js`):
   - User enters text and presses Enter or clicks Send
   - `sendMessage()` adds the user message to the UI and calls `generateResponse()`
   - `generateResponse()`:
     - Builds chat history with a system prompt that forces JSON output
     - Applies chat template using the processor
     - Tokenizes the prompt
     - Streams the response using TextStreamer (real-time token generation)
     - Parses JSON from the response and extracts the "response" field
     - Stores both raw and parsed responses in message history
   - Stats (TTFT - Time To First Token, Tokens/s) are calculated and displayed

### State Management

Global state is centralized in `chat.js`:
```javascript
export const chatState = {
  processor: null,      // Processor instance
  model: null,          // Model instance
  messages: [],         // Chat history
  isGenerating: false,  // Whether generation is in progress
  lastTTFT: null,       // Last Time To First Token
  lastTPS: null,        // Last Tokens Per Second
};
```

### Key Configuration

From `chat.js`:
- `MODEL_ID`: 'mistralai/Ministral-3-3B-Instruct-2512-ONNX'
- `MAX_NEW_TOKENS`: 512 (maximum tokens per response)

### Important Implementation Details

**JSON Response Parsing:**
- The system prompt forces the model to respond with JSON: `{"response": "...", "type": "text"}`
- The app uses regex to extract JSON from the response: `/\{[\s\S]*\}/`
- Only the "response" field is displayed to the user, but both raw and parsed responses are stored
- If JSON parsing fails, the raw response is displayed

**Streaming & Performance Metrics:**
- TextStreamer provides token-by-token streaming via callback function
- TTFT = Time from request start to first token (measures model startup latency)
- TPS = Tokens per second (measures generation speed)
- Metrics are calculated using `performance.now()` timestamps

**GPU Resource Management:**
- The app attempts to dispose of the model when the page unloads via `model.dispose()`
- Error handling wraps disposal in try-catch since dispose might not always be available

**Message Storage:**
- Messages include role, content, and optionally raw/parsed fields
- Full message history is maintained in `chatState.messages` for multi-turn conversations
- "Clear" button clears all history and resets stats

## Development Notes

- The application is intentionally simple: no build tools, no npm dependencies, just vanilla JavaScript with dynamic imports from CDN
- Two HTML files exist (`index.html` and `chat.html`) with identical content - consolidation could be considered
- The cache.js module is exported but currently unused - it was likely prepared for future model caching optimization
- All dependencies (Transformers.js, Mistral model) are loaded from CDN, so internet connectivity is required at runtime
- The UI is fully responsive with mobile-specific breakpoints in CSS

## Future Considerations

- Model file caching could be fully implemented using the IndexedDB utilities in `cache.js`
- Response history export/import could be added
- Theme switching (dark mode) could complement the current design
- The two HTML files could be consolidated
