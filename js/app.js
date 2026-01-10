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
 * Check if model is cached
 */
async function checkModelCache() {
  try {
    const cached = await cacheDB.get('model_loaded_timestamp');
    if (cached) {
      const cacheDate = new Date(cached);
      console.log(`Model cached at: ${cacheDate.toLocaleString()}`);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Error checking cache:', error);
    return false;
  }
}

/**
 * Load model and processor
 */
async function loadModel() {
  try {
    if (!checkWebGPU()) return;

    // Check cache status
    const isCached = await checkModelCache();
    if (isCached) {
      elements.statusText.textContent = 'Chargement depuis le cache...';
    }

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
      } else if (info.status === 'done') {
        elements.statusText.textContent = 'Finalisation...';
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

    // Store cache metadata
    await cacheDB.set('model_loaded_timestamp', Date.now());
    await cacheDB.set('model_id', CONFIG.MODEL_ID);

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

  // Add cache info display on startup
  displayCacheInfo();

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
 * Display cache information
 */
async function displayCacheInfo() {
  try {
    const timestamp = await cacheDB.get('model_loaded_timestamp');
    const modelId = await cacheDB.get('model_id');

    if (timestamp && modelId) {
      const cacheDate = new Date(timestamp);
      const daysSince = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
      console.log(`✓ Model cache active: ${modelId}`);
      console.log(`✓ Cached on: ${cacheDate.toLocaleString()}`);
      console.log(`✓ Cache age: ${daysSince} day(s)`);
      console.log('✓ Subsequent loads will be faster!');
    } else {
      console.log('ℹ Model will be downloaded and cached for faster future loads');
    }
  } catch (error) {
    console.warn('Could not access cache info:', error);
  }
}

/**
 * Initialize application
 */
async function init() {
  initElements();
  setupEventListeners();
  await loadModel();
}

// Expose cache utilities globally for debugging/management
window.modelCache = {
  info: async () => {
    const info = await cacheDB.getCacheInfo();
    if (info) {
      console.log('📦 Model Cache Information:');
      console.log(`  Model: ${info.modelId}`);
      console.log(`  Cached: ${info.cacheDate}`);
      console.log(`  Age: ${info.daysSince} day(s)`);
      console.log(`  Status: Active ✓`);
    } else {
      console.log('📦 No model cache found');
    }
    return info;
  },
  clear: async () => {
    const result = await cacheDB.clearModelCache();
    return result;
  },
  help: () => {
    console.log('📦 Model Cache Utilities:');
    console.log('  modelCache.info()  - Show cache information');
    console.log('  modelCache.clear() - Clear the model cache');
    console.log('  modelCache.help()  - Show this help message');
  }
};

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
