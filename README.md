# GlyphLab — chat « dessin de lettres en vecto »

App web minimale ajoutée à côté de `index.html` : une interface de chat qui
appelle l'API Mistral avec le SDK TypeScript officiel
([`@mistralai/mistralai`](https://docs.mistral.ai/getting-started/clients/)) et
le modèle `mistral-small-latest` pour dessiner des lettres en vecto (SVG),
rendues directement dans la page.

La clé `MISTRAL_API_KEY` n'existe que côté serveur (`src/server.ts`, via
`process.env` / `.env`) : elle n'est jamais envoyée au navigateur.

## Installer les dépendances

```bash
npm install
```

## Configurer la clé

```bash
cp .env.example .env
# puis éditer .env et renseigner :
# MISTRAL_API_KEY=sk-...
```

## Lancer en local

```bash
npm run dev      # avec rechargement à chaud → http://localhost:3000
```

ou sans fichier `.env` :

```bash
MISTRAL_API_KEY=sk-... npm start   # → http://localhost:3000
```

Le port se règle avec `PORT` (3000 par défaut).

## Utilisation

- Tapez par exemple « dessine la lettre R en vecto », ou cliquez sur une
  lettre A–Z : le modèle renvoie un extrait `<svg>` affiché en vecto, avec
  un lien pour télécharger le `.svg`.
- Toute autre question reçoit une réponse texte classique.

## Vérifier les types

```bash
npm run typecheck
```

## Arborescence ajoutée

    src/server.ts     serveur Node (statique + POST /api/chat, SDK Mistral)
    public/           interface de chat (HTML/CSS/JS vanilla)
    .env.example      modèle de configuration (la vraie clé reste en .env, git-ignoré)
