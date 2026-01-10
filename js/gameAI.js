/**
 * AI Integration layer for game-specific NPC interactions
 * Wraps chat.js functionality for NPC use
 */

import { chatState, CONFIG } from './chat.js';
import { cacheDB } from './cache.js';

export class GameAI {
  constructor() {
    this.processor = null;
    this.model = null;
    this.isInitialized = false;
  }

  /**
   * Check if model is cached
   */
  async checkModelCache() {
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
   * Initialize AI model (reuse chatState if available)
   */
  async initialize(progressCallback) {
    // Reuse chatState if already loaded
    if (chatState.processor && chatState.model) {
      this.processor = chatState.processor;
      this.model = chatState.model;
      this.isInitialized = true;
      console.log('Reusing loaded model from chatState');
      return;
    }

    // Check cache status
    const isCached = await this.checkModelCache();
    if (isCached && progressCallback) {
      progressCallback({ status: 'info', message: 'Loading from cache...' });
    }

    // Otherwise load model (same pattern as app.js)
    try {
      const { AutoProcessor, AutoModelForImageTextToText } = await import(
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'
      );

      this.processor = await AutoProcessor.from_pretrained(CONFIG.MODEL_ID, {
        cache_dir: './models-cache',
      });

      this.model = await AutoModelForImageTextToText.from_pretrained(CONFIG.MODEL_ID, {
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

      // Update chatState for potential reuse
      chatState.processor = this.processor;
      chatState.model = this.model;
      this.isInitialized = true;

      // Store cache metadata
      await cacheDB.set('model_loaded_timestamp', Date.now());
      await cacheDB.set('model_id', CONFIG.MODEL_ID);

      console.log('Model loaded successfully for game');
    } catch (error) {
      console.error('Error loading model:', error);
      throw error;
    }
  }

  /**
   * Generate NPC-specific response
   */
  async generateNPCResponse(npc, prompt, context = '') {
    if (!this.isInitialized) {
      throw new Error('GameAI not initialized');
    }

    if (chatState.isGenerating) {
      throw new Error('Model is already generating');
    }

    chatState.isGenerating = true;

    try {
      // Build NPC-specific message history
      // Ensure proper role alternation (user/assistant)
      let conversationHistory = npc.conversationHistory.slice(-5);

      // Ensure alternating roles - filter to maintain user->assistant->user pattern
      const validHistory = [];
      let expectedRole = 'user'; // First message after system should be user

      for (const msg of conversationHistory) {
        if (msg.role === expectedRole) {
          validHistory.push(msg);
          expectedRole = expectedRole === 'user' ? 'assistant' : 'user';
        }
      }

      const messages = [
        {
          role: 'system',
          content: npc.personality,
        },
        ...validHistory,
        {
          role: 'user',
          content: context ? `${context}\n${prompt}` : prompt,
        },
      ];

      // Debug: log message structure
      console.log(`[${npc.name}] Message roles:`, messages.map(m => m.role).join(' -> '));

      // Apply chat template
      const fullPrompt = this.processor.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true,
      });

      // Tokenize
      const inputs = await this.processor.tokenizer(fullPrompt, {
        add_special_tokens: false,
      });

      // Use streaming to properly decode tokens (same as chat.js)
      const { TextStreamer } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');

      let responseText = '';

      const streamer = new TextStreamer(this.processor.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (token) => {
          responseText += token;
        },
      });

      // Generate with streaming
      await this.model.generate({
        ...inputs,
        max_new_tokens: 1000, // Shorter for quick NPC responses
        do_sample: true,
        temperature: 0.8,
        repetition_penalty: 1.2,
        streamer,
      });

      // Parse JSON
      let parsedResponse = null;
      let displayText = responseText;
      let mood = 'neutral';

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
          displayText = parsedResponse.response || responseText;
          mood = parsedResponse.mood || 'neutral';
        }
      } catch (e) {
        console.warn('JSON parse failed for NPC response:', e);
        // Fallback to raw text
        displayText = responseText;
      }

      // Only update conversation history if we have valid response text
      if (displayText && displayText.trim().length > 0) {
        // Only add user message if the last message isn't already a user message
        const lastMessage = npc.conversationHistory[npc.conversationHistory.length - 1];
        if (!lastMessage || lastMessage.role !== 'user') {
          npc.conversationHistory.push({ role: 'user', content: prompt });
        }

        // Add assistant response
        npc.conversationHistory.push({ role: 'assistant', content: displayText });

        // Limit conversation history to prevent unbounded growth
        if (npc.conversationHistory.length > 20) {
          npc.conversationHistory = npc.conversationHistory.slice(-20);
        }

        npc.setDialogue(displayText, 6000); // Show for 6 seconds
        npc.mood = mood;
      } else {
        console.warn('Empty response from AI, not updating conversation history');
      }

      return {
        text: displayText,
        mood: mood,
        raw: responseText,
      };
    } finally {
      chatState.isGenerating = false;
    }
  }

  /**
   * Check WebGPU support
   */
  checkWebGPU() {
    return navigator.gpu !== undefined;
  }
}
