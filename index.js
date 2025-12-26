const { Client, GatewayIntentBits } = require('discord.js');
const { status } = require('minecraft-server-util');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// These will be set securely in Render later
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MC_HOST = process.env.MC_HOST;
const MC_PORT = Number(process.env.MC_PORT || 25565);

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'players') {
    try {
      const response = await status(MC_HOST, MC_PORT);

      await interaction.reply({
        content:
          `🟢 **Server Online**\n` +
          `Players: ${response.players.online} / ${response.players.max}`,
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
