const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { status } = require('minecraft-server-util');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MC_HOST = process.env.MC_HOST;
const MC_PORT = Number(process.env.MC_PORT || 25565);

const commands = [
  new SlashCommandBuilder()
    .setName('players')
    .setDescription('Shows the number of players and their usernames on the Minecraft server')
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    console.log('Refreshing slash commands...');
    await rest.put(
      Routes.applicationCommands(client.user.id), // Now client.user.id is defined
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
