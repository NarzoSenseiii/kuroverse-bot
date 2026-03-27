require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Fetching current global commands...');
    const commands = await rest.get(Routes.applicationCommands(process.env.CLIENT_ID));
    console.log(`Found ${commands.length} commands:`, commands.map(c => c.name));

    for (const command of commands) {
      if (command.name === 'ping') {
        console.log(`Skipping /ping`);
        continue;
      }
      await rest.delete(Routes.applicationCommand(process.env.CLIENT_ID, command.id));
      console.log(`Deleted /${command.name}`);
    }

    console.log('Done! Only /ping remains (if it existed).');
  } catch (err) {
    console.error(err);
  }
})();