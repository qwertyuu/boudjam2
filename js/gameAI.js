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
  async generateNPCResponse(npc, prompt, context = '', sharedContext = '') {
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

      // Combine context: world context + shared conversation context
      const fullContext = [context, sharedContext].filter(c => c && c.trim().length > 0).join('\n');
      
      const messages = [
        {
          role: 'system',
          content: npc.personality,
        },
        ...validHistory,
        {
          role: 'user',
          content: fullContext ? `${fullContext}\n${prompt}` : prompt,
        },
      ];

      // Debug: log message structure
      console.log(`[${npc.name}] Message roles:`, messages.map(m => m.role).join(' -> '));
      console.log(`[${npc.name}] Messages:`, messages.map(m => m.content).join('\n\n---\n'));

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
        temperature: 0.2,
        repetition_penalty: 1.2,
        streamer,
      });

      // Parse and clean JSON response
      let parsedResponse = null;
      let displayText = responseText;
      let mood = 'neutral';

      try {
        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[0];
          
          // Clean the JSON string
          const cleanedJson = this.cleanJSON(jsonStr);
          
          // Parse the cleaned JSON
          parsedResponse = JSON.parse(cleanedJson);
          
          // Validate required fields
          if (parsedResponse.response && typeof parsedResponse.response === 'string') {
            displayText = parsedResponse.response.trim();
            mood = parsedResponse.mood || 'neutral';
          } else {
            console.warn('Invalid JSON structure - missing response field');
            displayText = responseText;
          }
        }
      } catch (e) {
        console.warn('JSON parse failed for NPC response:', e, 'Raw:', responseText);
        // Fallback to raw text
        displayText = responseText;
      }

      console.log(`[${npc.name}] AI Response:`, displayText);

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
   * Clean JSON string to ensure valid formatting
   * Removes extra characters, fixes quotes, and validates structure
   */
  cleanJSON(jsonStr) {
    // Remove leading/trailing whitespace
    let cleaned = jsonStr.trim();

    // Remove markdown code blocks if present
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/, '');

    // First, let's identify the structure: find response and mood values
    // This is more robust than trying to fix quotes
    
    // Extract the response field content
    const responseMatch = cleaned.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*,/);
    const moodMatch = cleaned.match(/"mood"\s*:\s*"([^"]*?)"\s*[}\]]/);
    
    if (responseMatch && moodMatch) {
      const response = responseMatch[1];
      const mood = moodMatch[1];
      
      // Build clean JSON with properly escaped strings
      return JSON.stringify({
        response: response,
        mood: mood
      });
    }

    // Fallback: try to fix common quote issues and parse
    // Replace smart quotes with regular quotes
    cleaned = cleaned.replace(/[\u201C\u201D]/g, '"'); // "" -> ""
    cleaned = cleaned.replace(/[\u2018\u2019]/g, "'"); // '' -> ''

    // Remove trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Ensure the JSON starts with { and ends with }
    const startIdx = cleaned.indexOf('{');
    const lastIdx = cleaned.lastIndexOf('}');

    if (startIdx !== -1 && lastIdx !== -1 && lastIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, lastIdx + 1);
    }

    return cleaned;
  }

  /**
   * Check WebGPU support
   */
  checkWebGPU() {
    return navigator.gpu !== undefined;
  }
}
