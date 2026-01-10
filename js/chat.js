/**
 * Chat functionality module
 */

// Constants
export const CONFIG = {
  MODEL_ID: 'mistralai/Ministral-3-3B-Instruct-2512-ONNX',
  MAX_NEW_TOKENS: 512,
};

// State
export const chatState = {
  processor: null,
  model: null,
  messages: [],
  isGenerating: false,
  lastTTFT: null,
  lastTPS: null,
};

// DOM Elements
export const elements = {
  loadingDiv: null,
  chatDiv: null,
  messagesDiv: null,
  userInput: null,
  sendBtn: null,
  clearBtn: null,
  progressBar: null,
  statusText: null,
  statsSpan: null,
  headerStats: null,
};

/**
 * Initialize DOM elements
 */
export function initElements() {
  elements.loadingDiv = document.getElementById('loading');
  elements.chatDiv = document.getElementById('chat');
  elements.messagesDiv = document.getElementById('messages');
  elements.userInput = document.getElementById('user-input');
  elements.sendBtn = document.getElementById('send-btn');
  elements.clearBtn = document.getElementById('clear-btn');
  elements.progressBar = document.getElementById('progress');
  elements.statusText = document.getElementById('status');
  elements.statsSpan = document.getElementById('stats');
  elements.headerStats = document.getElementById('header-stats');
}

/**
 * Check WebGPU support
 */
export function checkWebGPU() {
  if (!navigator.gpu) {
    const error = 'WebGPU non supporté. Utilisez Chrome 113+, Edge 113+ ou Firefox Nightly.';
    elements.statusText.textContent = error;
    elements.loadingDiv.innerHTML += `<div class="error-message">${error}</div>`;
    elements.sendBtn.disabled = true;
    return false;
  }
  return true;
}

/**
 * Render a message in the chat
 */
export function renderMessage(role, content, isStreaming = false) {
  elements.messagesDiv.classList.remove('empty');

  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = `message-content ${isStreaming ? 'streaming' : ''}`;
  contentDiv.textContent = content;

  msgDiv.appendChild(contentDiv);
  elements.messagesDiv.appendChild(msgDiv);

  // Auto-scroll
  setTimeout(() => elements.messagesDiv.scrollTop = elements.messagesDiv.scrollHeight, 0);

  return contentDiv;
}

/**
 * Update stats display
 */
export function updateStats(ttft, tps) {
  if (ttft !== null) {
    chatState.lastTTFT = (ttft / 1000).toFixed(3);
  }
  if (tps !== null) {
    chatState.lastTPS = tps.toFixed(2);
  }

  const ttftStr = chatState.lastTTFT !== null ? `${chatState.lastTTFT}s` : '—';
  const tpsStr = chatState.lastTPS !== null ? chatState.lastTPS : '—';

  elements.statsSpan.textContent = `TTFT: ${ttftStr} | Tokens/s: ${tpsStr}`;
}

/**
 * Clear conversation
 */
export function clearConversation() {
  chatState.messages = [];
  elements.messagesDiv.innerHTML = '';
  elements.messagesDiv.classList.add('empty');
  elements.userInput.value = '';
  chatState.lastTTFT = null;
  chatState.lastTPS = null;
  updateStats(null, null);
  elements.userInput.focus();
}

/**
 * Send message
 */
export function sendMessage() {
  const text = elements.userInput.value.trim();
  if (!text || chatState.isGenerating) return;

  // Disable input
  elements.userInput.value = '';
  elements.userInput.disabled = true;
  elements.sendBtn.disabled = true;
  chatState.isGenerating = true;

  // Render user message
  renderMessage('user', text);

  // Generate response
  return generateResponse(text);
}

/**
 * Generate AI response
 */
export async function generateResponse(userMessage) {
  try {
    // Add user message to history
    chatState.messages.push({ role: 'user', content: userMessage });

    // Build chat messages with JSON structure requirement
    const chatMessages = [
      {
        role: 'system',
        content: `You are a helpful, concise AI assistant. You MUST respond with ONLY valid JSON in this exact format:
{
  "response": "your answer here",
  "type": "text"
}

Do not add any text before or after the JSON. The JSON must be valid and parseable.`
      },
      ...chatState.messages,
    ];

    // Apply chat template
    const prompt = chatState.processor.apply_chat_template(chatMessages, {
      tokenize: false,
      add_generation_prompt: true,
    });

    // Tokenize (text only, no image)
    const inputs = await chatState.processor.tokenizer(prompt, {
      add_special_tokens: false,
    });

    // Create assistant message for streaming
    const contentDiv = renderMessage('assistant', '', true);
    let fullText = '';
    let tokenCount = 0;
    const startTime = performance.now();
    let firstTokenTime = null;

    // Dynamically import TextStreamer
    const { TextStreamer } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');

    // TextStreamer for streaming
    const streamer = new TextStreamer(chatState.processor.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (token) => {
        if (!firstTokenTime) {
          firstTokenTime = performance.now();
          const ttft = firstTokenTime - startTime;
          updateStats(ttft, null);
        }

        fullText += token;
        contentDiv.textContent = fullText;
        tokenCount++;

        // Update TPS
        const elapsed = (performance.now() - firstTokenTime) / 1000;
        if (elapsed > 0) {
          const tps = tokenCount / elapsed;
          updateStats(null, tps);
        }
      },
    });

    // Generate
    await chatState.model.generate({
      ...inputs,
      max_new_tokens: CONFIG.MAX_NEW_TOKENS,
      do_sample: false,
      streamer,
      repetition_penalty: 1.2,
    });

    // Finalize message - Parse JSON if present
    contentDiv.classList.remove('streaming');

    // Try to extract and parse JSON
    let parsedResponse = null;
    let displayText = fullText;

    try {
      // Try to find JSON in the response
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
        displayText = parsedResponse.response || fullText;
        // Ensure displayText is a string
        if (typeof displayText !== 'string') {
          displayText = JSON.stringify(displayText);
        }
      }
    } catch (jsonError) {
      console.warn('Could not parse JSON response:', jsonError);
      // Fallback to raw text if JSON parsing fails
      displayText = fullText;
    }

    // Ensure displayText is always a string
    if (typeof displayText !== 'string') {
      displayText = String(displayText);
    }

    // Update display with parsed content
    contentDiv.textContent = displayText;

    // Store the original response (with JSON if available)
    chatState.messages.push({
      role: 'assistant',
      content: displayText,
      raw: fullText,
      parsed: parsedResponse
    });

    console.log('Réponse générée:', displayText.substring(0, 50) + '...');
    if (parsedResponse) {
      console.log('JSON structuré:', parsedResponse);
    }
  } catch (error) {
    console.error('Erreur lors de la génération:', error);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = `Erreur: ${error.message}`;
    elements.messagesDiv.appendChild(errorDiv);
  } finally {
    // Re-enable input
    chatState.isGenerating = false;
    elements.userInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.userInput.focus();
  }
}
