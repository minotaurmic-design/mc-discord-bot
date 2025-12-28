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
const MC_RAW = process.env.MC_HOST || '82.24.111.241:25565';

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
// Bot Ready
// ===============================
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

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
});

// ===============================
// Command Handler
// ===============================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'players') {
    try {
      const response = await status(MC_HOST, MC_PORT);

      let namesText = 'No player names available.';
      if (response.players.sample?.length) {
        const names = response.players.sample.map(p => p.name);
        namesText = names.join(', ');
      }

      await interaction.reply(
        `🟢 **Server Online**\n` +
        `Players: ${response.players.online} / ${response.players.max}\n` +
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
