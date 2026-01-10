# 🎮 SPÉCIFICATIONS DU JEU MULTIJOUEUR NPC AUTONOME

## 1. ARCHITECTURE MULTIJOUEUR

### 1.1 Structure des joueurs
- Chaque joueur possède UN NPC qu'il contrôle
- Chaque NPC a une identité distincte (nom, personnalité, mood)
- Les NPCs évoluent dans le même monde partagé mais gardent leur historique personnel

### 1.2 Configuration pré-jeu
- Interface de paramétrage avant lancement :
  - Nom du NPC
  - Personnalité/caractère (traits de caractère)
  - Mood initial (état émotionnel de départ)
  - Objectif/motivation du NPC
- Bouton "Lancer la simulation" pour démarrer

### 1.3 Stockage décentralisé
- Chaque joueur stocke ses données localement (IndexedDB/localStorage)
- Structure de données par joueur :
  - ID unique du joueur/NPC
  - Configuration du NPC (nom, personnalité, mood)
  - Historique des événements vécus
  - Historique des messages générés
  - État actuel (position, mood, stats)

---

## 2. SYSTÈME DE GÉNÉRATION (SANS ASSISTANT)

### 2.1 Architecture des messages
- **SUPPRESSION du rôle "assistant"**
- Structure simplifiée :
  - `system` : Prompt système (règles du jeu, format de sortie attendu)
  - `user` : Contexte complet du NPC (historique + état actuel + événements récents)
- Tout le contexte dans UN SEUL message user

### 2.2 System prompt
```
Contenu suggéré :
- Règles du monde (physique, interactions possibles)
- Format de sortie attendu (action, dialogue, pensée, mood)
- Contraintes de comportement
- Instructions de cohérence
```

### 2.3 User message unique
```
Structure proposée :
[NPC : {nom}]
[Personnalité : {traits}]
[Mood actuel : {mood}]
[Historique récent : {derniers événements}]
[Situation actuelle : {contexte}]
[Autres NPCs visibles : {liste}]

Que fait {nom} maintenant ?
```

---

## 3. EXTRACTION DE CONTENU (REGEX/STRING MATCHING)

### 3.1 Abandon du JSON
- Le LLM génère du texte libre structuré
- Utilisation de marqueurs textuels simples

### 3.2 Format de sortie attendu
```
ACTION: [description de l'action]
DIALOGUE: [ce que dit le NPC]
PENSÉE: [pensée interne]
MOOD: [nouveau mood]
```

### 3.3 Regex d'extraction
- `ACTION:\s*(.+?)(?=DIALOGUE:|PENSÉE:|MOOD:|$)`
- `DIALOGUE:\s*(.+?)(?=ACTION:|PENSÉE:|MOOD:|$)`
- `PENSÉE:\s*(.+?)(?=ACTION:|DIALOGUE:|MOOD:|$)`
- `MOOD:\s*(.+?)(?=ACTION:|DIALOGUE:|PENSÉE:|$)`

### 3.4 Fallback pour extraction
- Si aucun marqueur trouvé → traiter tout le texte comme ACTION
- Si marqueurs partiels → extraire ce qui est disponible
- Ne jamais bloquer la simulation

---

## 4. STREAMING EN TEMPS RÉEL

### 4.1 Affichage du stream
- Zone de texte dédiée "Génération en cours..."
- Affichage token par token pendant la génération
- Animation visuelle (clignotement du curseur)

### 4.2 Traitement post-génération
- Une fois le stream complet → extraction via regex
- Mise à jour de l'affichage avec contenu parsé
- Le texte brut reste visible (optionnel : mode debug)

---

## 5. SYSTÈME DE MOOD

### 5.1 États émotionnels
- Liste de moods prédéfinis : joyeux, triste, en colère, calme, excité, anxieux, confiant, effrayé, etc.
- Le mood influence la génération (inclus dans le prompt)

### 5.2 Évolution du mood
- Le LLM génère un nouveau mood dans sa réponse
- Si aucun mood généré → conserver le mood précédent
- Affichage visuel du mood (emoji, couleur, icône)

### 5.3 Impact du mood
- Influence les actions générées (ex: un NPC en colère sera plus agressif)
- Peut affecter les interactions avec autres NPCs

---

## 6. GESTION DE LA RÉSILIENCE

### 6.1 Contenu incohérent
- Si extraction échoue complètement :
  - Conserver le dernier état valide
  - Logger l'erreur en debug
  - Continuer la simulation
  - Optionnel : régénérer avec prompt modifié

### 6.2 Contenu incompris
- Si action impossible/illogique :
  - Accepter quand même et simuler
  - Ou : interpréter de manière raisonnable
  - Ou : ignorer et faire action par défaut ("attend")

### 6.3 Stratégies de fallback
1. Extraction partielle : utiliser ce qui est disponible
2. État par défaut : NPC "réfléchit" ou "observe"
3. Pas de blocage : la simulation ne s'arrête jamais

---

## 7. INTERFACE UTILISATEUR

### 7.1 Écran de configuration
- Formulaire pour chaque joueur
- Champs : nom, personnalité (textarea), mood initial (dropdown)
- Bouton "Rejoindre le monde"

### 7.2 Écran de jeu
- Vue du monde (canvas ou div)
- Liste des NPCs présents
- Pour chaque NPC :
  - Nom + mood actuel
  - Dernière action
  - Dernier dialogue
  - Zone de streaming (génération en cours)
- Logs d'événements globaux

### 7.3 Contrôles joueur
- Bouton "Pause/Play" pour son NPC
- Bouton "Voir historique"
- Curseur de vitesse de génération
- Bouton "Réinitialiser mon NPC"

---

## 8. HISTORIQUE DÉCENTRALISÉ

### 8.1 Stockage local par joueur
```javascript
{
  playerId: "uuid",
  npc: {
    name: "...",
    personality: "...",
    mood: "...",
  },
  history: [
    {
      timestamp: 123456789,
      action: "...",
      dialogue: "...",
      thought: "...",
      mood: "...",
      rawOutput: "..." // texte brut du LLM
    }
  ],
  currentState: {
    mood: "...",
    position: "...",
    etc: "..."
  }
}
```

### 8.2 Partage inter-joueurs
- Broadcast uniquement des actions visibles (action, dialogue)
- Chaque joueur reconstruit sa vision du monde
- Pas de serveur central : peer-to-peer ou événements locaux

---

## 9. BOUCLE DE JEU

### 9.1 Cycle de génération
```
1. Construire le prompt (system + user unique)
2. Lancer la génération avec streaming
3. Afficher le stream en temps réel
4. Fin de génération → extraction regex
5. Si extraction réussit :
   - Mettre à jour l'état du NPC
   - Sauvegarder dans l'historique
   - Broadcast aux autres joueurs
6. Si extraction échoue :
   - Conserver l'état précédent
   - Logger l'erreur
7. Attendre X secondes (ou selon vitesse configurée)
8. Recommencer au 1
```

### 9.2 Synchronisation
- Chaque NPC génère à son propre rythme
- Pas de tour par tour
- Événements asynchrones

---

## 10. OPTIMISATIONS TECHNIQUES

### 10.1 Performance
- Limiter l'historique dans le prompt (ex: 10 derniers événements)
- Résumé des événements anciens
- Nettoyage périodique du cache

### 10.2 Tokens
- MAX_NEW_TOKENS adapté (256-512)
- Prompt optimisé pour être concis
- Historique condensé

### 10.3 WebGPU
- Gestion mémoire pour plusieurs générations simultanées
- File d'attente si trop de NPCs actifs
- Libération des ressources

---

## 11. ÉVOLUTIVITÉ

### 11.1 Phase 1 (MVP)
- 2-4 NPCs maximum
- Monde textuel simple
- Interactions basiques

### 11.2 Phase 2
- Canvas visuel pour représenter le monde
- Plus de NPCs (5-10)
- Événements globaux (météo, quêtes)

### 11.3 Phase 3
- Networking P2P réel
- Sauvegarde/chargement de parties
- NPCs qui peuvent "mourir" ou "partir"
