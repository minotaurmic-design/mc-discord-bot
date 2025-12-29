// ===============================
// Dummy Express server for Render
// ===============================
const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is running!'));

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

// ===============================
// Keep Render awake (self-ping)
// ===============================
setInterval(() => {
  if (!process.env.RENDER_EXTERNAL_URL) return;

  https
    .get(process.env.RENDER_EXTERNAL_URL, res => {
      res.resume();
      console.log('Self-ping sent to keep service awake');
    })
    .on('error', () => {});
}, 14 * 60 * 1000); // every 14 minutes

// ===============================
// Discord + Minecraft Bot
// ===============================
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const { status } = require('minecraft-server-util');

// Environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

// DedicatedMC-style address can be host:port in one value
const MC_RAW = process.env.MC_HOST || '82.24.111.241:25565';

// Channel to post automated updates into
const STATUS_CHANNEL_ID = process.env.STATUS_CHANNEL_ID;

// Poll interval for change detection
const POLL_SECONDS = Number(process.env.POLL_SECONDS || 60);

// Parse Minecraft host + port
let MC_HOST = MC_RAW;
let MC_PORT = 25565;

if (MC_RAW.includes(':')) {
  const parts = MC_RAW.split(':');
  MC_HOST = parts[0];
  MC_PORT = Number(parts[1]);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===============================
// Slash Command Definition
// ===============================
const commands = [
  new SlashCommandBuilder()
    .setName('players')
    .setDescription('Show Minecraft server player count and usernames')
].map(cmd => cmd.toJSON());

// ===============================
// Helper: fetch server status
// ===============================
async function getMinecraftSnapshot() {
  const response = await status(MC_HOST, MC_PORT);

  const online = response.players.online;
  const max = response.players.max;

  // Note: sample may be missing even when players are online (depends on server config).
  const names = Array.isArray(response.players.sample)
    ? response.players.sample.map(p => p.name)
    : [];

  return { online, max, names };
}

function formatNames(names, onlineCount) {
  if (!names.length) return 'No player names available.';
  const shown = names.slice(0, 10);
  let text = shown.join(', ');
  if (onlineCount > shown.length) text += ', ...';
  return text;
}

// ===============================
// Automated change notifications
// ===============================
let lastKnown = {
  isOnline: null,   // unknown at start
  online: null,     // last player count
  max: null
};

async function postChangeIfNeeded(channel) {
  try {
    const snap = await getMinecraftSnapshot();

    const now = {
      isOnline: true,
      online: snap.online,
      max: snap.max
    };

    const changed =
      lastKnown.isOnline !== now.isOnline ||
      lastKnown.online !== now.online ||
      lastKnown.max !== now.max;

    if (changed) {
      const namesText = formatNames(snap.names, snap.online);

      await channel.send(
        `🟢 **Minecraft Server Online**\n` +
        `Players: ${snap.online} / ${snap.max}\n` +
        `Online: ${namesText}`
      );

      lastKnown = now;
      console.log('Posted status change:', lastKnown);
    }
  } catch (err) {
    // Server unreachable/offline
    const now = { isOnline: false, online: 0, max: lastKnown.max };

    const changed = lastKnown.isOnline !== now.isOnline;

    if (changed) {
      await channel.send('🔴 **Minecraft Server Offline or Unreachable**');
      lastKnown = now;
      console.log('Posted offline transition');
    }
  }
}

// ===============================
// Bot Ready
// ===============================
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Validate required env vars
  if (!STATUS_CHANNEL_ID) {
    console.warn('STATUS_CHANNEL_ID is not set. Automated updates will be disabled.');
  }

  // Register slash commands (guild-scoped = near-instant)
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered');
  } catch (err) {
    console.error('Command registration failed:', err);
  }

  // Start automated polling loop (only if channel configured)
  if (STATUS_CHANNEL_ID) {
    try {
      const channel = await client.channels.fetch(STATUS_CHANNEL_ID);

      if (!channel || !channel.isTextBased()) {
        console.error('STATUS_CHANNEL_ID does not resolve to a text channel.');
        return;
      }

      // Initial check/post (sets baseline and possibly posts first message)
      await postChangeIfNeeded(channel);

      // Poll regularly; only posts when something changes
      setInterval(() => {
        postChangeIfNeeded(channel).catch(() => {});
      }, POLL_SECONDS * 1000);

      console.log(`Automated status polling enabled: every ${POLL_SECONDS}s`);
    } catch (err) {
      console.error('Failed to start automated updates:', err);
    }
  }
});

// ===============================
// Command Handler
// ===============================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'players') {
    try {
      const snap = await getMinecraftSnapshot();
      const namesText = formatNames(snap.names, snap.online);

      await interaction.reply(
        `🟢 **Server Online**\n` +
        `Players: ${snap.online} / ${snap.max}\n` +
        `Online: ${namesText}`
      );
    } catch (err) {
      await interaction.reply('🔴 Server is offline or unreachable.');
    }
  }
});

// ===============================
// Login
// ===============================
client.login(DISCORD_TOKEN);
