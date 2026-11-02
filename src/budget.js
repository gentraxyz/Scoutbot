const config = require('./config');
const store = require('./storage');

// Last AI request time per user, for the cooldown. In memory only: a restart just clears a few seconds of cooldown.
const lastRequest = new Map();

const today = () => new Date().toISOString().slice(0, 10); // UTC day, so the limit resets at 00:00 UTC

// Usage and owner settings live in store.data.budget. Owner changes override the .env defaults.
function state() {
  const budget = (store.data.budget ??= {
    paused: false,
    dailyLimit: null,
    cooldownSeconds: null,
    day: today(),
    tokensToday: 0,
    callsToday: 0,
    imageCallsToday: 0,
    imageDailyLimit: null,
    totalTokens: 0,
    totalCalls: 0,
    totalImageCalls: 0,
  });
  if (budget.day !== today()) {
    budget.day = today();
    budget.tokensToday = 0;
    budget.callsToday = 0;
    budget.imageCallsToday = 0;
  }
  return budget;
}

// 0 in the store means unlimited (Infinity), since JSON cannot hold Infinity.
const limit = () => {
  const value = state().dailyLimit ?? config.ai.dailyTokenLimit;
  return value === 0 ? Infinity : value;
};
// Separate daily cap for images: /imagine bills per image, not per token.
const imageLimit = () => {
  const value = state().imageDailyLimit ?? config.ai.imageDailyLimit;
  return value === 0 ? Infinity : value;
};
const cooldownSeconds = () => state().cooldownSeconds ?? config.ai.cooldownSeconds;

// Throws if the AI is paused or today's token limit is used up.
function assertAvailable() {
  const budget = state();
  if (budget.paused) throw new Error('The AI is paused right now. Try again later.');
  if (budget.tokensToday >= limit()) {
    throw new Error('The AI has reached its daily limit. It resets at 00:00 UTC.');
  }
}

// Throws if the user asked less than the cooldown ago. Otherwise starts a new cooldown for them.
function checkCooldown(userId) {
  const cooldownMs = cooldownSeconds() * 1000;
  const now = Date.now();
  const elapsed = now - (lastRequest.get(userId) ?? 0);
  if (elapsed < cooldownMs) {
    const wait = Math.ceil((cooldownMs - elapsed) / 1000);
    throw new Error(`Slow down! You can ask me again in ${wait}s.`);
  }

  lastRequest.set(userId, now);
  if (lastRequest.size > 5000) {
    for (const [id, time] of lastRequest) if (now - time >= cooldownMs) lastRequest.delete(id);
  }
}

function record(tokens) {
  const budget = state();
  budget.tokensToday += tokens;
  budget.callsToday += 1;
  budget.totalTokens += tokens;
  budget.totalCalls += 1;
  store.save();
}

// Counts generated images: one call to the image API per image.
function recordImages(count) {
  const budget = state();
  budget.callsToday += count;
  budget.totalCalls += count;
  budget.imageCallsToday += count;
  budget.totalImageCalls += count;
  store.save();
}

function status() {
  const budget = state();
  return {
    paused: budget.paused,
    limit: limit(),
    imageLimit: imageLimit(),
    cooldownSeconds: cooldownSeconds(),
    tokensToday: budget.tokensToday,
    callsToday: budget.callsToday,
    imageCallsToday: budget.imageCallsToday,
    totalTokens: budget.totalTokens,
    totalCalls: budget.totalCalls,
    totalImageCalls: budget.totalImageCalls,
    day: budget.day,
  };
}

// Throws if the image budget is paused or used up (resets at 00:00 UTC).
function assertImagesAvailable() {
  const budget = state();
  if (budget.paused) throw new Error('The AI is paused right now. Try again later.');
  if (budget.imageCallsToday >= imageLimit()) {
    throw new Error('The daily image limit is reached. It resets at 00:00 UTC.');
  }
}

// Whether n more images fit in today's image budget.
function canGenerateImages(n) {
  const budget = state();
  if (budget.paused) return false;
  return budget.imageCallsToday + n <= imageLimit();
}

// Images left today (Infinity when unlimited).
function imagesLeft() {
  const budget = state();
  const limit = imageLimit();
  return limit === Infinity ? Infinity : Math.max(0, limit - budget.imageCallsToday);
}

function setLimit(tokens) {
  state().dailyLimit = tokens; // 0 = unlimited
  store.save();
}

function setImageLimit(images) {
  state().imageDailyLimit = images; // 0 = unlimited
  store.save();
}

function setCooldown(seconds) {
  state().cooldownSeconds = seconds;
  store.save();
}

function setPaused(paused) {
  state().paused = paused;
  store.save();
}

function resetToday() {
  const budget = state();
  budget.tokensToday = 0;
  budget.callsToday = 0;
  budget.imageCallsToday = 0;
  store.save();
}

module.exports = {
  assertAvailable,
  assertImagesAvailable,
  canGenerateImages,
  checkCooldown,
  imagesLeft,
  record,
  recordImages,
  status,
  setLimit,
  setImageLimit,
  setCooldown,
  setPaused,
  resetToday,
};
