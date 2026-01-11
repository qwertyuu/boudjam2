# Guide de Prompting pour Ministral 3B

Guide complet pour obtenir les meilleurs résultats avec le modèle Ministral 3B de Mistral AI.

## Table des matières

1. [Paramètres de Génération](#1-paramètres-de-génération-recommandés)
2. [Structure du Prompt](#2-structure-du-prompt)
3. [Bonnes Pratiques](#3-bonnes-pratiques-essentielles)
4. [Techniques Avancées](#4-techniques-avancées)
5. [Erreurs à Éviter](#5-erreurs-à-éviter)
6. [Function Calling](#6-utilisation-des-tools-function-calling)
7. [Vision](#7-vision-images)
8. [Template Optimisé](#8-template-de-prompt-optimisé)
9. [Dépannage](#9-itération-et-dépannage)

---

## 1. Paramètres de Génération Recommandés

| Paramètre | Valeur recommandée | Usage |
|-----------|-------------------|-------|
| **Température** | 0.1 - 0.15 | Production, tâches précises |
| **Température** | 0.3 - 0.7 | Tâches créatives |
| **Max tokens** | 16 384 | Limite de sortie (Instruct) |
| **Contexte max** | 262 144 | Fenêtre de contexte (256k) |

> **Note:** Pour les environnements de production, privilégiez une température inférieure à 0.1 pour des réponses plus déterministes.

---

## 2. Structure du Prompt

### Format de Base

```
[INST] Votre instruction ici [/INST]
```

### Avec System Prompt

Le system prompt définit le comportement global du modèle :

```python
messages = [
    {"role": "system", "content": "Tu es un assistant expert en..."},
    {"role": "user", "content": "Ta question ici"}
]
```

### Conversation Multi-Tours

```
<s>[INST] premier message utilisateur[/INST] réponse assistant</s>
[INST] deuxième message utilisateur[/INST] réponse assistant</s>
[INST] troisième message[/INST]
```

### Tokens Spéciaux

| Token | Signification |
|-------|---------------|
| `<s>` | Début de séquence (BOS) |
| `</s>` | Fin de séquence (EOS) |
| `[INST]` | Début d'instruction utilisateur |
| `[/INST]` | Fin d'instruction utilisateur |

---

## 3. Bonnes Pratiques Essentielles

### Clarté et Spécificité

| Mauvais | Bon |
|---------|-----|
| "Parle-moi de l'énergie" | "Explique la différence entre les sources d'énergie renouvelables et non-renouvelables en 3 paragraphes" |
| "Fais un résumé" | "Résume ce texte en 5 bullet points de maximum 20 mots chacun" |
| "Améliore ce code" | "Optimise cette fonction pour réduire sa complexité temporelle de O(n²) à O(n log n)" |

### Définir un Rôle

```
Tu es un <rôle>, ta tâche est de <tâche spécifique>
```

**Exemples:**
- "Tu es un développeur Python senior, ta tâche est de réviser du code et identifier les bugs potentiels"
- "Tu es un rédacteur technique, ta tâche est d'expliquer des concepts complexes de manière simple"

### Organisation Hiérarchique

Structurez vos prompts en sections claires :

```markdown
# Contexte
Tu es un développeur Python senior.

# Tâche
Analyse le code suivant et identifie les bugs.

# Contraintes
- Réponds en français
- Liste les bugs par ordre de gravité
- Propose une correction pour chaque bug

# Code à analyser
```python
def calculate(x):
    return x / 0
```
```

### Utiliser le Formatage

- **Markdown** pour la structure (titres, listes, code)
- **XML** pour délimiter des sections (`<context>...</context>`)
- **JSON** pour les sorties structurées

---

## 4. Techniques Avancées

### Few-Shot Prompting

Incluez des exemples pour guider le format de sortie :

```
# Exemples
Input: Hello, how are you?
Output: {"langue": "en", "sentiment": "neutre"}

Input: Je suis très content !
Output: {"langue": "fr", "sentiment": "positif"}

# Maintenant analyse ceci:
Input: Das ist wunderbar!
Output:
```

### Sortie JSON Structurée

Forcez un format précis :

```
Réponds UNIQUEMENT avec un objet JSON valide au format:
{
  "response": "ta réponse ici",
  "confidence": 0.95,
  "category": "technique|général|créatif"
}

Ne fournis AUCUN texte avant ou après le JSON.
```

### Contraintes Explicites

```
# Contraintes de format
- Écris sur un ton professionnel
- Utilise des bullet points
- Maximum 200 mots
- Ne fais pas d'hypothèses non demandées

# Contraintes de contenu
- Base-toi uniquement sur les informations fournies
- Si tu ne sais pas, dis "Je ne dispose pas de cette information"
- Cite tes sources quand applicable
```

### Chain of Thought (Raisonnement étape par étape)

```
Résous ce problème étape par étape:
1. Identifie d'abord les éléments clés
2. Analyse chaque élément
3. Formule ta conclusion

Montre ton raisonnement à chaque étape.
```

---

## 5. Erreurs à Éviter

### Langage Vague

| À éviter | Alternative |
|----------|-------------|
| "trop long" | "maximum 100 mots" |
| "intéressant" | "pertinent pour un développeur junior" |
| "beaucoup d'exemples" | "3 exemples" |
| "rapidement" | "en moins de 2 phrases" |

### Autres Erreurs Courantes

| Erreur | Pourquoi c'est problématique | Solution |
|--------|------------------------------|----------|
| Demander au modèle de compter | Les LLMs sont mauvais pour compter | Fournir les comptages en entrée |
| Échelles numériques seules (1-5) | Interprétation ambiguë | Échelles verbales ("Faible/Moyen/Élevé") |
| Instructions contradictoires | Confusion du modèle | Utiliser des arbres de décision clairs |
| Générer du contenu superflu | Latence et tokens gaspillés | Demander uniquement le nécessaire |
| Surcharger avec trop d'outils | Confusion dans le choix | Limiter au strict nécessaire |

---

## 6. Utilisation des Tools (Function Calling)

Ministral 3B supporte nativement le function calling :

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Obtient la météo actuelle d'une ville",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "Nom de la ville (ex: Paris, Lyon)"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Unité de température"
                    }
                },
                "required": ["city"]
            }
        }
    }
]
```

### Bonnes Pratiques pour les Tools

1. **Descriptions claires** - Expliquez précisément ce que fait chaque fonction
2. **Paramètres bien documentés** - Incluez des exemples dans les descriptions
3. **Limiter le nombre** - Évitez de surcharger le modèle avec trop d'outils
4. **Valeurs par défaut** - Utilisez `required` uniquement pour les paramètres essentiels

---

## 7. Vision (Images)

Ministral 3B supporte l'analyse d'images. Pour des résultats optimaux :

### Recommandations

- **Ratio d'aspect:** Proche de 1:1 (carré)
- **Éviter:** Images trop larges ou trop étroites
- **Recadrer:** Si nécessaire pour respecter le ratio

### Exemple d'utilisation

```python
messages = [
    {
        "role": "user",
        "content": [
            {"type": "text", "text": "Décris cette image en détail"},
            {"type": "image_url", "image_url": {"url": "https://exemple.com/image.jpg"}}
        ]
    }
]
```

---

## 8. Template de Prompt Optimisé

Voici un template réutilisable pour des prompts efficaces :

```markdown
# Rôle
Tu es [description précise du rôle et de l'expertise].

# Contexte
[Informations de fond pertinentes pour la tâche]
[Données ou documents à prendre en compte]

# Tâche
[Description claire et spécifique de ce que tu attends]

# Format de sortie
[Spécification exacte du format attendu]
Exemple:
```
{
  "field": "valeur attendue"
}
```

# Contraintes
- [Contrainte 1: ton, style, longueur]
- [Contrainte 2: ce qu'il faut inclure]
- [Contrainte 3: ce qu'il faut éviter]

# Exemples (optionnel)
Input: [exemple d'entrée]
Output: [exemple de sortie attendue]

# Entrée à traiter
[Les données réelles à traiter]
```

### Exemple Concret

```markdown
# Rôle
Tu es un expert en sécurité informatique spécialisé dans l'audit de code.

# Contexte
Je développe une API REST en Node.js pour une application bancaire.
L'application gère des données sensibles (informations de compte, transactions).

# Tâche
Analyse le code suivant et identifie toutes les vulnérabilités de sécurité.

# Format de sortie
Pour chaque vulnérabilité trouvée, fournis:
- Nom de la vulnérabilité (OWASP si applicable)
- Ligne(s) concernée(s)
- Niveau de risque (Critique/Élevé/Moyen/Faible)
- Correction recommandée avec code

# Contraintes
- Concentre-toi uniquement sur les problèmes de sécurité
- Ignore les problèmes de style ou de performance
- Priorise par niveau de risque

# Code à analyser
```javascript
app.get('/user/:id', (req, res) => {
  const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
  db.query(query, (err, result) => {
    res.json(result);
  });
});
```
```

---

## 9. Itération et Dépannage

### Problèmes Courants et Solutions

| Problème | Cause probable | Solution |
|----------|----------------|----------|
| Réponses hors sujet | Contexte insuffisant | Ajouter plus d'informations de fond |
| Format incorrect | Pas d'exemple fourni | Inclure un exemple de sortie attendue |
| Réponses trop longues | Pas de limite spécifiée | Ajouter "Maximum X mots/phrases" |
| Réponses trop courtes | Instructions trop vagues | Demander des détails spécifiques |
| Hallucinations | Manque de contraintes | Demander de citer ses sources ou dire "je ne sais pas" |
| Incohérences | Instructions contradictoires | Simplifier et clarifier les règles |

### Processus d'Itération

1. **Tester** - Essayez votre prompt initial
2. **Analyser** - Identifiez ce qui ne fonctionne pas
3. **Ajuster** - Modifiez une chose à la fois
4. **Documenter** - Notez ce qui fonctionne pour réutilisation

### Checklist Avant Envoi

- [ ] Le rôle est-il clairement défini ?
- [ ] La tâche est-elle spécifique et mesurable ?
- [ ] Le format de sortie est-il explicite ?
- [ ] Les contraintes sont-elles sans ambiguïté ?
- [ ] Un exemple est-il fourni si nécessaire ?
- [ ] La température est-elle adaptée à la tâche ?

---

## Sources et Références

- [Mistral AI - Prompting Capabilities](https://docs.mistral.ai/guides/prompting_capabilities)
- [Mistral AI - Tokenization & Chat Templates](https://docs.mistral.ai/cookbooks/concept-deep-dive-tokenization-chat_templates)
- [Ministral-3-3B-Instruct-2512 - Hugging Face](https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512)
- [Mistral System Prompt Best Practices - PromptLayer](https://blog.promptlayer.com/mistral-system-prompt/)
- [Mistral 7B Prompt Engineering Guide](https://www.promptingguide.ai/models/mistral-7b)
- [Introducing Mistral 3 - Mistral AI](https://mistral.ai/news/mistral-3)

---

*Guide généré le 11 janvier 2026*
