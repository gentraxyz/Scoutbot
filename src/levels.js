const { AttachmentBuilder, Events } = require('discord.js');
const store = require('./storage');
const { renderRankCard } = require('./rankcard');

const XP_MIN = 15;
const XP_MAX = 25;
const COOLDOWN_MS = 60_000;
const DELETE_AFTER_MS = 2 * 60_000;
const CHECK_EVERY_MS = 5_000;

const lastXpAt = new Map(); // `${guildId}:${userId}` -> timestamp, only used to rate-limit XP

// Levels live on the guild record in store.json, so XP, ranks and pending deletions survive restarts.
function levelsConfig(guildId) {
  const guild = store.guild(guildId);
  guild.levels ??= { enabled: true, theme: 'claude', users: {}, pending: [] };
  return guild.levels;
}

// Total XP needed to reach a level: 100 for level 1, 300 for level 2, 600 for level 3, and so on.
const totalXp = (level) => 50 * level * (level + 1);

function levelFor(xp) {
  let level = 0;
  while (totalXp(level + 1) <= xp) level += 1;
  return level;
}

function progressOf(xp) {
  const level = levelFor(xp);
  return { level, floor: totalXp(level), next: totalXp(level + 1) };
}

// Ranks are computed from the stored XP, so they stay correct after any /xp change.
function rankOf(cfg, userId) {
  const sorted = Object.entries(cfg.users).sort(([, a], [, b]) => b.xp - a.xp);
  const index = sorted.findIndex(([id]) => id === userId);
  return index === -1 ? sorted.length + 1 : index + 1;
}

function setXp(guildId, userId, xp) {
  const cfg = levelsConfig(guildId);
  const current = cfg.users[userId] ?? { xp: 0, messages: 0 };
  cfg.users[userId] = { ...current, xp: Math.max(0, Math.floor(xp)) };
  store.save();
  return cfg.users[userId].xp;
}

async function cardFor(user, guildId) {
  const cfg = levelsConfig(guildId);
  const xp = cfg.users[user.id]?.xp ?? 0;
  const { level, floor, next } = progressOf(xp);
  return renderRankCard({
    username: user.globalName ?? user.username,
    avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
    themeId: cfg.theme,
    level,
    xp,
    floor,
    next,
    rank: rankOf(cfg, user.id),
  });
}

async function announceLevelUp(message, level, cfg) {
  const png = await cardFor(message.author, message.guild.id);
  const file = new AttachmentBuilder(png, { name: 'level-up.png' });
  const sent = await message.channel
    .send({
      content: `🎉 <@${message.author.id}> reached **level ${level}**!`,
      files: [file],
      allowedMentions: { parse: [] },
    })
    .catch(() => null);
  if (!sent) return;

  // Deleted by the scheduler after 2 minutes. Stored in store.json, so the timer survives restarts.
  cfg.pending.push({ channelId: sent.channelId, messageId: sent.id, deleteAt: Date.now() + DELETE_AFTER_MS });
  store.save();
}

async function handleMessage(message) {
  if (!message.guild || message.author.bot) return;
  const cfg = levelsConfig(message.guild.id);
  if (!cfg.enabled) return;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if (now - (lastXpAt.get(key) ?? 0) < COOLDOWN_MS) return;
  lastXpAt.set(key, now);

  const user = (cfg.users[message.author.id] ??= { xp: 0, messages: 0 });
  const before = levelFor(user.xp);
  user.xp += XP_MIN + Math.floor(Math.random() * (XP_MAX - XP_MIN + 1));
  user.messages += 1;
  store.save();

  const after = levelFor(user.xp);
  if (after > before) await announceLevelUp(message, after, cfg);
}

// Deletes level-up messages whose 2 minutes are over, including ones that were due while the bot was offline.
function startScheduler(client) {
  const sweep = async () => {
    const now = Date.now();
    for (const guild of client.guilds.cache.values()) {
      const cfg = store.data.guilds[guild.id]?.levels;
      const due = cfg?.pending?.filter((p) => p.deleteAt <= now) ?? [];
      for (const p of due) {
        const channel = await guild.channels.fetch(p.channelId).catch(() => null);
        const message = channel?.isTextBased() ? await channel.messages.fetch(p.messageId).catch(() => null) : null;
        await message?.delete().catch(() => {});
      }
      if (due.length) {
        cfg.pending = cfg.pending.filter((p) => p.deleteAt > now);
        store.save();
      }
    }
  };
  sweep().catch((err) => console.error('Level sweep failed:', err.message));
  setInterval(() => sweep().catch((err) => console.error('Level sweep failed:', err.message)), CHECK_EVERY_MS);
}

function register(client) {
  client.on(Events.MessageCreate, (message) => {
    handleMessage(message).catch((err) => console.error('XP update failed:', err.message));
  });
}

module.exports = {
  levelsConfig,
  levelFor,
  totalXp,
  progressOf,
  rankOf,
  setXp,
  cardFor,
  register,
  startScheduler,
};
