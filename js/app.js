/**
 * Main application module
 */

import { AutoProcessor, AutoModelForImageTextToText } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
import { cacheDB } from './cache.js';
import {
  CONFIG,
  chatState,
  elements,
  initElements,
  checkWebGPU,
  clearConversation,
  sendMessage,
  generateResponse,
} from './chat.js';

/**
 * Load model and processor
 */
async function loadModel() {
  try {
    if (!checkWebGPU()) return;

    elements.statusText.textContent = 'Chargement du processeur...';
    chatState.processor = await AutoProcessor.from_pretrained(CONFIG.MODEL_ID, {
      cache_dir: './models-cache',
    });

    elements.statusText.textContent = 'Chargement du modèle...';

    const progressCallback = (info) => {
      if (info.status === 'progress') {
        const percentage = Math.round((info.loaded / info.total) * 100);
        elements.progressBar.value = percentage;
        elements.statusText.textContent = `Téléchargement: ${percentage}%`;
      }
    };

    // Load with caching options
    chatState.model = await AutoModelForImageTextToText.from_pretrained(CONFIG.MODEL_ID, {
      dtype: {
        embed_tokens: 'fp16',
        vision_encoder: 'q4',
        decoder_model_merged: 'q4f16',
      },
      device: 'webgpu',
      progress_callback: progressCallback,
      cache_dir: './models-cache',
      local_files_only: false,
    });

    // Show chat interface
    elements.loadingDiv.style.display = 'none';
    elements.chatDiv.classList.add('active');
    elements.headerStats.textContent = 'Connecté';
    elements.userInput.focus();

    console.log('Modèle chargé avec succès');
  } catch (error) {
    console.error('Erreur lors du chargement du modèle:', error);
    elements.statusText.textContent = `Erreur: ${error.message}`;
    elements.messagesDiv.innerHTML = `<div class="error-message">Erreur: ${error.message}</div>`;
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Handle Enter key
  elements.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !chatState.isGenerating) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-grow textarea
  elements.userInput.addEventListener('input', () => {
    elements.userInput.style.height = 'auto';
    elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 100) + 'px';
  });

  // Button click handlers
  elements.sendBtn.addEventListener('click', sendMessage);
  elements.clearBtn.addEventListener('click', clearConversation);

  // Clean up GPU resources on page unload
  window.addEventListener('beforeunload', () => {
    if (chatState.model && typeof chatState.model.dispose === 'function') {
      try {
        chatState.model.dispose();
      } catch (e) {
        console.warn('Error disposing model:', e);
      }
    }
  });
}

/**
 * Initialize application
 */
async function init() {
  initElements();
  setupEventListeners();
  await loadModel();
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
