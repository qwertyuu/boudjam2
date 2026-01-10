// gameloop.js - Game loop for autonomous NPC generation

import { buildCompletePrompt } from './prompts.js';
import { extractAndClean } from './extractor.js';
import { savePlayerData, addHistoryEntry } from './storage.js';
import { updateMood } from './mood.js';
import { broadcastAction } from './broadcast.js';

// Active NPC loops
const activeLoops = new Map();

// Start NPC generation loop (SPECS.md section 9.1)
export async function startNPCLoop(playerData, processor, model, onUpdate, options = {}) {
  const {
    speed = 5000, // milliseconds between generations
    maxTokens = 512,
    otherNPCs = []
  } = options;

  const npcId = playerData.playerId;

  // Stop existing loop if any
  if (activeLoops.has(npcId)) {
    stopNPCLoop(npcId);
  }

  const loopState = {
    active: true,
    paused: false,
    speed,
    playerData,
    processor,
    model,
    onUpdate,
    otherNPCs
  };

  activeLoops.set(npcId, loopState);

  // Start the loop
  runGenerationCycle(npcId, loopState);

  return npcId;
}

// Run single generation cycle
async function runGenerationCycle(npcId, loopState) {
  if (!loopState.active) return;

  if (loopState.paused) {
    // Check again after 1 second
    setTimeout(() => runGenerationCycle(npcId, loopState), 1000);
    return;
  }

  try {
    // Step 1: Build prompt
    const { system, user } = buildCompletePrompt(
      loopState.playerData.npc,
      loopState.playerData.history,
      loopState.otherNPCs
    );

    // Step 2-3: Generate with streaming
    let generatedText = '';

    loopState.onUpdate({
      type: 'stream_start',
      npcId,
      npc: loopState.playerData.npc
    });

    try {
      // Build messages (NO assistant role - SPECS.md section 2.1)
      const messages = [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ];

      // Apply chat template
      const prompt = loopState.processor.apply_chat_template(messages, {
        tokenize: false,
        add_generation_prompt: true,
      });

      // Tokenize
      const inputs = await loopState.processor.tokenizer(prompt, {
        add_special_tokens: false,
      });

      // Generate with streaming
      const outputs = await loopState.model.generate({
        ...inputs,
        max_new_tokens: 512,
        do_sample: true,
        temperature: 0.8,
      }, (output) => {
        // Stream callback
        const decoded = loopState.processor.tokenizer.decode(output[0], { skip_special_tokens: true });
        generatedText = decoded;

        loopState.onUpdate({
          type: 'stream_token',
          npcId,
          text: generatedText,
          npc: loopState.playerData.npc
        });
      });

      // Final generated text
      const finalOutput = loopState.processor.tokenizer.batch_decode(outputs, { skip_special_tokens: true })[0];
      generatedText = finalOutput;

    } catch (error) {
      console.error('Generation error:', error);
      // Fallback: NPC waits/observes
      generatedText = 'ACTION: regarde autour\nPENSÉE: Je me demande ce qui se passe...';
    }

    // Step 4: Extract content
    const extracted = extractAndClean(generatedText);

    // Step 5: Update state if extraction successful
    if (extracted.success) {
      // Update current state
      loopState.playerData.currentState.lastAction = extracted.action;
      loopState.playerData.currentState.lastDialogue = extracted.dialogue;
      loopState.playerData.currentState.lastThought = extracted.thought;

      // Update mood if provided
      if (extracted.mood) {
        loopState.playerData.currentState.mood = updateMood(
          loopState.playerData.currentState.mood,
          extracted.mood
        );
      }

      // Add to history
      addHistoryEntry(loopState.playerData, {
        action: extracted.action,
        dialogue: extracted.dialogue,
        thought: extracted.thought,
        mood: loopState.playerData.currentState.mood,
        rawOutput: generatedText
      });

      // Save to storage
      try {
        await savePlayerData(loopState.playerData);
      } catch (error) {
        console.error('Save error:', error);
      }

      // Broadcast to other players
      try {
        broadcastAction(npcId, extracted.action, extracted.dialogue, {
          name: loopState.playerData.npc.name,
          mood: loopState.playerData.currentState.mood
        });
      } catch (error) {
        console.error('Broadcast error:', error);
      }

      // Notify update complete
      loopState.onUpdate({
        type: 'generation_complete',
        npcId,
        extracted,
        rawText: generatedText,
        npc: loopState.playerData.npc,
        currentState: loopState.playerData.currentState
      });

    } else {
      // Step 6: Extraction failed - keep previous state
      console.warn('Extraction failed for NPC:', npcId);
      loopState.onUpdate({
        type: 'extraction_failed',
        npcId,
        rawText: generatedText,
        npc: loopState.playerData.npc
      });
    }

  } catch (error) {
    console.error('Game loop error:', error);
    loopState.onUpdate({
      type: 'error',
      npcId,
      error: error.message,
      npc: loopState.playerData.npc
    });
  }

  // Step 7: Wait and repeat
  if (loopState.active) {
    setTimeout(() => runGenerationCycle(npcId, loopState), loopState.speed);
  }
}

// Stop NPC loop
export function stopNPCLoop(npcId) {
  const loopState = activeLoops.get(npcId);
  if (loopState) {
    loopState.active = false;
    activeLoops.delete(npcId);
  }
}

// Pause NPC loop
export function pauseNPCLoop(npcId) {
  const loopState = activeLoops.get(npcId);
  if (loopState) {
    loopState.paused = true;
  }
}

// Resume NPC loop
export function resumeNPCLoop(npcId) {
  const loopState = activeLoops.get(npcId);
  if (loopState) {
    loopState.paused = false;
  }
}

// Update loop speed
export function setLoopSpeed(npcId, speed) {
  const loopState = activeLoops.get(npcId);
  if (loopState) {
    loopState.speed = speed;
  }
}

// Update other NPCs list
export function updateOtherNPCs(npcId, otherNPCs) {
  const loopState = activeLoops.get(npcId);
  if (loopState) {
    loopState.otherNPCs = otherNPCs;
  }
}

// Check if NPC loop is active
export function isLoopActive(npcId) {
  const loopState = activeLoops.get(npcId);
  return loopState ? loopState.active : false;
}

// Check if NPC loop is paused
export function isLoopPaused(npcId) {
  const loopState = activeLoops.get(npcId);
  return loopState ? loopState.paused : false;
}
