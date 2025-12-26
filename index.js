const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is running!'));

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { status } = require('minecraft-server-util');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Environment variables from Render
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MC_RAW = process.env.MC_HOST || '82.24.111.241:25565'; // single string, host:port
const GUILD_ID = '870474050286268468'; // replace with your server ID

// Parse host and port
let MC_HOST = MC_RAW;
let MC_PORT = 25565;
if (MC_RAW.includes(':')) {
  const parts = MC_RAW.split(':');
  MC_HOST = parts[0];
  MC_PORT = Number(parts[1]);
}

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('players')
    .setDescription('Shows the number of players and their usernames on the Minecraft server')
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register commands for this guild (instant update)
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    console.log('Registering slash commands for the guild...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'players') {
    try {
      const response = await status(MC_HOST, MC_PORT);

      let namesText = 'No player names available.';
      if (response.players.sample && response.players.sample.length > 0) {
        const names = response.players.sample.slice(0, 10).map(p => p.name);
        namesText = names.join(', ');
        if (response.players.online > 10) namesText += ', ...';
      }

      await interaction.reply({
        content:
          `🟢 **Server Online**\n` +
          `Players: ${response.players.online} / ${response.players.max}\n` +
          `Online: ${namesText}`,
        ephemeral: false
      });
    } catch (error) {
      await interaction.reply({
        content: '🔴 Server is offline or unreachable.',
        ephemeral: false
      });
    }
  }
});

client.login(DISCORD_TOKEN);
