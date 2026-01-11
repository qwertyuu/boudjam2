# Plan d'Amélioration des Prompts NPC

## Analyse du Prompt Actuel

### Points Forts ✅
- Structure claire avec sections markdown (`# Rôle`, `# Contexte`, etc.)
- Exemples few-shot fournis (2 exemples)
- Contraintes explicites
- Format de sortie bien défini avec marqueurs

### Problèmes Identifiés ❌

| Problème | Impact | Référence Guide |
|----------|--------|-----------------|
| System prompt trop long (~400 tokens) | Consomme du contexte inutilement | §3 - Organisation Hiérarchique |
| Répétition d'infos entre system/user | Tokens gaspillés | §5 - Générer du contenu superflu |
| Historique peu structuré | Contexte flou pour le modèle | §4 - Few-Shot Prompting |
| Pas de gestion des relations inter-NPC | Interactions plates | §3 - Définir un Rôle |
| Température 0.3 peut être trop créative | Réponses incohérentes | §1 - Paramètres |

---

## Plan de Modifications

### 1. Restructurer le System Prompt (Priorité Haute)

**Fichier:** `js/gameAI.js:114-142`

**Avant:**
```
# Rôle
Tu es ${npc.name}. ${cleanPersonality}

# Contexte
Monde médiéval fantastique où la magie existe. Tu es autonome avec tes propres objectifs.

# Format de sortie
Réponds avec ces marqueurs (un par ligne):
DIALOGUE: ce que tu dis à voix haute
...
```

**Après:**
```
Tu es ${npc.name}, un personnage dans un monde médiéval fantastique.

Trait: ${cleanPersonality}

Réponds UNIQUEMENT avec ce format exact:
ACTION: [geste physique en 1 phrase]
DIALOGUE: [parole] OU PENSÉE: [réflexion interne]
MOOD: [un mot parmi: joyeux|triste|en colère|calme|excité|curieux|anxieux|confiant|effrayé|méfiant|déterminé|neutre|surpris|fatigué]
```

**Pourquoi:**
- Réduit de ~400 à ~150 tokens
- Déplace les exemples dans le user message (plus efficace selon le guide)
- Format plus contraignant = moins d'erreurs de parsing

---

### 2. Enrichir le Contexte Utilisateur (Priorité Haute)

**Fichier:** `js/gameAI.js:146-154`

**Modifications:**
- Ajouter les **relations** entre NPCs (ami/ennemi/neutre)
- Structurer l'historique avec des timestamps relatifs
- Ajouter un **objectif actuel** pour le NPC

**Nouveau format du user message:**
```javascript
const userContent = `# Toi
Nom: ${npc.name}
Humeur actuelle: ${npc.mood}
Objectif: ${npc.currentGoal || 'Aucun objectif particulier'}

# Tes dernières actions
${formattedOwnHistory}

# Ce qui se passe autour de toi
${formattedSharedContext}

# Exemple de réponse attendue
ACTION: observe les alentours avec méfiance
DIALOGUE: Qui ose troubler ma méditation ?
MOOD: méfiant

Que fais-tu ?`;
```

---

### 3. Améliorer le Formatage de l'Historique (Priorité Moyenne)

**Fichier:** `js/gameAI.js:146`

**Problème actuel:**
```
- Dit: "Par la grâce des Dieux éternels..."
- Dit: "Par les ombres d'Urbithos..."
```

**Amélioration proposée:**
```javascript
const formatHistory = (history, maxItems = 3) => {
  return history.slice(-maxItems).map((h, i) => {
    const timeAgo = maxItems - i; // 3, 2, 1 (plus récent)
    const timeLabel = timeAgo === 1 ? 'À l\'instant' : `Il y a ${timeAgo} tours`;
    return `[${timeLabel}] ${h}`;
  }).join('\n');
};
```

**Résultat:**
```
[Il y a 3 tours] Dit: "Par la grâce des Dieux..."
[Il y a 2 tours] Dit: "Par les ombres..."
[À l'instant] Fait: lève son épée
```

---

### 4. Ajouter un Système de Relations (Priorité Moyenne)

**Nouveau fichier suggéré:** `js/relationships.js`

**Concept:**
```javascript
// Dans NPC class
this.relationships = {
  'Sauron le Sauriste': { attitude: 'hostile', history: ['m\'a menacé', 'a volé mon pain'] },
  'Elara': { attitude: 'amical', history: ['m\'a soigné'] }
};
```

**Impact sur le prompt:**
```
# Relations
- Sauron le Sauriste: HOSTILE (t'a menacé récemment)
- Elara: AMICAL (t'a aidé)
```

---

### 5. Optimiser les Paramètres de Génération (Priorité Basse)

**Fichier:** `js/gameAI.js:191-198`

| Paramètre | Actuel | Recommandé | Raison |
|-----------|--------|------------|--------|
| `temperature` | 0.3 | 0.15 | Plus cohérent pour les interactions |
| `max_new_tokens` | 150 | 100 | Format court suffit |
| `repetition_penalty` | 1.2 | 1.3 | Éviter les répétitions de dialogue |

---

### 6. Ajouter des Contraintes Négatives Explicites (Priorité Basse)

**Dans le system prompt, ajouter:**
```
NE FAIS PAS:
- Ne répète pas ce que les autres viennent de dire
- Ne pose pas de questions rhétoriques à toi-même
- N'utilise pas de mots modernes (OK, cool, etc.)
```

---

## Ordre d'Implémentation Recommandé

1. **Phase 1 - Quick Wins**
   - [ ] Réduire le system prompt (étape 1)
   - [ ] Baisser la température à 0.15

2. **Phase 2 - Amélioration du Contexte**
   - [ ] Reformater l'historique avec timestamps (étape 3)
   - [ ] Restructurer le user message (étape 2)

3. **Phase 3 - Fonctionnalités Avancées**
   - [ ] Implémenter le système de relations (étape 4)
   - [ ] Ajouter les objectifs NPC

---

## Exemple de Prompt Final Optimisé

### System Message (~120 tokens)
```
Tu es Sire Galahad, chevalier noble dans un monde médiéval fantastique.

Format de réponse OBLIGATOIRE (une ligne par marqueur):
ACTION: [ton geste physique]
DIALOGUE: [ce que tu dis] OU PENSÉE: [ta réflexion]
MOOD: [joyeux|triste|en colère|calme|curieux|anxieux|confiant|effrayé|méfiant|déterminé|neutre]

Règles: 1 phrase max par marqueur. Pas de markdown.
```

### User Message (~200 tokens)
```
# Ton état
Humeur: déterminé
Objectif: Protéger le royaume

# Tes actions récentes
[Il y a 2 tours] Dit: "Par la grâce des Dieux éternels..."
[À l'instant] Dégaine mon épée

# Ce qui se passe
Sauron le Sauriste (HOSTILE) dit: "Le vent murmure entre nos doigts..."
Sauron le Sauriste tend les bras, révélant sa couronne sombre

# Exemple
ACTION: brandit mon épée vers le ciel
DIALOGUE: Arrière, créature des ténèbres !
MOOD: déterminé

Que fais-tu maintenant ?
```

---

## Métriques de Succès

| Métrique | Avant | Objectif |
|----------|-------|----------|
| Tokens system prompt | ~400 | <150 |
| Taux de parsing réussi | ~80% | >95% |
| Répétitions de dialogue | Fréquent | Rare |
| Cohérence des interactions | Variable | Stable |

---

*Plan créé le 11 janvier 2026*
