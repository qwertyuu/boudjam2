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
  /**
   * Generator for regex-based responses
   */
  async generateNPCResponse(npc, prompt, context = '', sharedContext = '', onProgress = null) {
    if (!this.isInitialized) {
      throw new Error('GameAI not initialized');
    }

    if (chatState.isGenerating) {
      throw new Error('Model is already generating');
    }

    chatState.isGenerating = true;

    try {
      // 1. Construct System Prompt (optimized for token efficiency)
      // Extract clean personality (remove "Tu es X." prefix if present)
      const cleanPersonality = npc.personality.replace(/^Tu es [^.]+\.\s*/i, '');

      const systemPrompt = `Tu es ${npc.name}, un personnage dans un monde médiéval fantastique.

Trait: ${cleanPersonality}

Réponds UNIQUEMENT avec ce format exact:
ACTION: [geste physique en 1 courte phrase]
DIALOGUE: [parole] OU PENSÉE: [réflexion interne]
MOOD: [joyeux|triste|en colère|calme|excité|curieux|anxieux|confiant|effrayé|méfiant|déterminé|neutre|surpris|fatigué]`;

      // 2. Construct User Message (enriched context with relationships)
      const ownHistoryFormatted = this.formatHistory(npc.localHistory, 3);
      const currentGoal = npc.currentGoal || 'Aucun objectif particulier';
      const contextSection = context ? `\n# Situation\n${context}\n` : '';
      const relationshipsSection = npc.getRelationshipsContext() ? `\n${npc.getRelationshipsContext()}\n` : '';

      const userContent = `# Toi
Nom: ${npc.name}
Humeur actuelle: ${npc.mood}
Objectif: ${currentGoal}

${ownHistoryFormatted ? `# Tes dernières actions\n${ownHistoryFormatted}\n` : ''}${sharedContext ? `# Ce qui se passe autour de toi\n${sharedContext}\n` : ''}${relationshipsSection}${contextSection}# Exemple de réponse attendue
ACTION: observe les alentours avec méfiance
DIALOGUE: Qui ose troubler ma méditation ?
MOOD: méfiant

ACTION: se redresse brusquement
DIALOGUE: Montre-toi, étranger !
MOOD: en colère

ACTION: serre son épée plus fort
PENSÉE: Je dois protéger ce village coûte que coûte.
MOOD: déterminé

Que fais-tu maintenant ?`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ];
      console.log(`[${npc.name}] Prompt:\n${JSON.stringify(messages, null, 2)}`);
      console.log(`[${npc.name}] Generating with prompt size:`, userContent.length);

      // Apply chat template
      const fullPrompt = this.processor.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true,
      });

      // Tokenize
      const inputs = await this.processor.tokenizer(fullPrompt, {
        add_special_tokens: false,
      });

      // Use streaming
      const { TextStreamer } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');

      let responseText = '';

      const streamer = new TextStreamer(this.processor.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (token) => {
          responseText += token;
          if (onProgress) {
            onProgress(token);
          }
        },
      });

      // Generate
      await this.model.generate({
        ...inputs,
        max_new_tokens: 200, // Optimized: format court suffit
        do_sample: true,
        temperature: 0.1, // Plus cohérent pour les interactions
        repetition_penalty: 1.3, // Éviter les répétitions
        streamer,
      });

      console.log(`[${npc.name}] Raw Output:\n${responseText}`);

      // 3. Parse Response via Regex
      const parsed = this.parseAIResponse(responseText);

      // Update NPC state based on parsed content
      if (parsed.mood) npc.mood = parsed.mood.toLowerCase();
      if (parsed.thought) {
        if (!npc.thoughts) npc.thoughts = [];
        npc.thoughts.push(parsed.thought);
        // Visualise thought if no dialogue (dialogue takes precedence for visual)
        if (!parsed.dialogue) {
          npc.setThought(parsed.thought, 4000);
        }
      }

      // Store action/dialogue in local history
      const summary = parsed.dialogue ? `Dit: "${parsed.dialogue}"` : (parsed.action ? `Fait: ${parsed.action}` : 'Rien');

      // Set Action (Visual)
      // Visualise action alongside dialogue if present
      if (parsed.action) {
        npc.setAction(parsed.action);
      }

      if (!npc.localHistory) npc.localHistory = [];
      npc.localHistory.push(summary);

      // Limit history
      if (npc.localHistory.length > 20) npc.localHistory = npc.localHistory.slice(-20);
      if (npc.thoughts && npc.thoughts.length > 20) npc.thoughts = npc.thoughts.slice(-20);

      // Set Dialogue (Visual)
      if (parsed.dialogue) {
        npc.setDialogue(parsed.dialogue, 6000);
      } else if (parsed.action && !parsed.thought) {
        // Optional: visualize action as a thought/narrative if no speech/thought?
        // or just rely on game log.
      }


      // Return structured data for game implementation
      return {
        text: parsed.dialogue || parsed.action || "...",
        action: parsed.action,
        dialogue: parsed.dialogue,
        thought: parsed.thought,
        mood: parsed.mood,
        raw: responseText
      };

    } finally {
      chatState.isGenerating = false;
    }
  }

  /**
   * Clean text by removing markdown artifacts and normalizing whitespace
   */
  cleanText(text) {
    if (!text) return null;
    return text
      .replace(/\*+/g, '')            // Remove * and **
      .replace(/^\s*[-•]\s*/gm, '')   // Remove bullet points
      .replace(/^["']+|["']+$/g, '')  // Remove wrapping quotes
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .trim();
  }

  /**
   * Parser using Regex to extract fields from free text
   */
  parseAIResponse(text) {
    const result = {
      action: null,
      dialogue: null,
      thought: null,
      mood: null
    };

    // Helper to extract content by tag
    // Looks for TAG: content until the next TAG: or end of string
    const extract = (tag) => {
      // Regex explanation:
      // ${tag}: matches the tag literal
      // \s* matches optional whitespace
      // ([\s\S]+?) matches content non-greedily (including newlines)
      // (?=...|$) lookahead for next tag or end of string
      // The list of known tags to stop at: ACTION:|DIALOGUE:|PENSÉE:|MOOD:
      const regex = new RegExp(`${tag}:\\s*([\\s\\S]+?)(?=(?:ACTION:|DIALOGUE:|PENSÉE:|MOOD:|$))`, 'i');
      const match = text.match(regex);
      return match ? this.cleanText(match[1]) : null;
    };

    result.action = extract('ACTION');
    result.dialogue = extract('DIALOGUE');
    result.thought = extract('PENSÉE');
    result.mood = extract('MOOD');

    // FALLBACK 1: If no tags found but text exists, treat as Action or Dialogue
    if (!result.action && !result.dialogue && !result.thought && !result.mood && text.trim().length > 0) {
      const cleanedText = this.cleanText(text);
      if (text.includes('"')) {
        // Assume speech if quotes present
        result.dialogue = cleanedText;
      } else {
        // Assume action
        result.action = cleanedText;
      }
    }

    return result;
  }

  /**
   * Format history with relative timestamps
   */
  formatHistory(history, maxItems = 3) {
    if (!history || history.length === 0) return '';

    return history.slice(-maxItems).map((h, i) => {
      const timeAgo = maxItems - i;
      const timeLabel = timeAgo === 1 ? 'À l\'instant' : `Il y a ${timeAgo} tours`;
      return `[${timeLabel}] ${h}`;
    }).join('\n');
  }

  /**
   * Check WebGPU support
   */
  checkWebGPU() {
    return navigator.gpu !== undefined;
  }
}
