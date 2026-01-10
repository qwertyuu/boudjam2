// extractor.js - Regex-based content extraction for NPC responses

// Extract NPC response components from raw text
export function extractNPCResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      action: 'réfléchit',
      dialogue: '',
      thought: '',
      mood: null,
      success: false
    };
  }

  // Regex patterns from SPECS.md section 3.3
  const actionRegex = /ACTION:\s*(.+?)(?=DIALOGUE:|PENSÉE:|MOOD:|$)/is;
  const dialogueRegex = /DIALOGUE:\s*(.+?)(?=ACTION:|PENSÉE:|MOOD:|$)/is;
  const thoughtRegex = /PENSÉE:\s*(.+?)(?=ACTION:|DIALOGUE:|MOOD:|$)/is;
  const moodRegex = /MOOD:\s*(.+?)(?=ACTION:|DIALOGUE:|PENSÉE:|$)/is;

  const actionMatch = rawText.match(actionRegex);
  const dialogueMatch = rawText.match(dialogueRegex);
  const thoughtMatch = rawText.match(thoughtRegex);
  const moodMatch = rawText.match(moodRegex);

  const hasAnyMatch = actionMatch || dialogueMatch || thoughtMatch || moodMatch;

  // Fallback strategy from SPECS.md section 3.4
  const result = {
    action: actionMatch ? actionMatch[1].trim() : (hasAnyMatch ? '' : rawText.trim()),
    dialogue: dialogueMatch ? dialogueMatch[1].trim() : '',
    thought: thoughtMatch ? thoughtMatch[1].trim() : '',
    mood: moodMatch ? moodMatch[1].trim() : null,
    success: hasAnyMatch || rawText.length > 0
  };

  // If no markers found and text exists, treat as action
  if (!hasAnyMatch && rawText.trim()) {
    result.action = rawText.trim();
  }

  return result;
}

// Validate extracted response
export function validateExtraction(extracted) {
  return {
    ...extracted,
    action: extracted.action || 'attend',
    dialogue: extracted.dialogue || '',
    thought: extracted.thought || '',
    mood: extracted.mood || null
  };
}

// Clean extracted text (remove extra whitespace, newlines, etc.)
export function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/\n+/g, ' ')  // Replace newlines with spaces
    .trim();
}

// Extract with cleaned text
export function extractAndClean(rawText) {
  const extracted = extractNPCResponse(rawText);
  return {
    action: cleanText(extracted.action),
    dialogue: cleanText(extracted.dialogue),
    thought: cleanText(extracted.thought),
    mood: extracted.mood ? cleanText(extracted.mood) : null,
    success: extracted.success
  };
}
