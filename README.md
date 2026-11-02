# ScoutBot

Discord bot with AI chat, support tickets, moderation, levels, logs, giveaways and backups.

## Setup

```bash
npm install
cp .env.example .env   # then fill in DISCORD_TOKEN and the AI_* keys
node index.js
```

Only `DISCORD_TOKEN` and `AI_*` settings belong in `.env`; it is gitignored and never uploaded.

## Sending changes to GitHub

Run `push.cmd` (double-click, or from a terminal with an optional message):

```bat
push.cmd "Fix rank card colors"
```

It stages everything, commits if something changed and pushes. On the very first run it also
creates the GitHub repository and links it as `origin`.

The host can then pull from `https://github.com/itzremyx/Scoutbot.git`. `data/`, `.env` and
`node_modules/` are gitignored, so pulls never overwrite the host's own settings or database.

## Useful commands

- `/help` — list all commands
- `/setup` — first-run configuration (logs channel, tickets, levels)
- `/memory` — user facts, server rules, pending approvals
