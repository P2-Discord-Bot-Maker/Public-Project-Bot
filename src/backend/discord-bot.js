import Discord, { EmbedBuilder } from 'discord.js'; // Importing Discord & embedBuilder from discord.js
import dotenv from 'dotenv'
import { register_guild_commands } from './register-commands.js';
import { client } from './discord-bot-client.js'
import fetch from 'node-fetch';
import assert from 'assert';
import { get_commands } from './get-commands.js';

dotenv.config(); // Loads token from .env file
const token = process.env.DISCORD_BOT_TOKEN;
const origin = process.env.SERVER_ORIGIN;
const password = process.env.SERVER_PASSWORD;

assert(origin !== undefined, "SERVER_ORIGIN missing from .env file");
assert(token !== undefined, "DISCORD_BOT_TOKEN missing from .env file");

//Load commands into client.commands
client.commands = new Discord.Collection();
(await get_commands()).forEach(command => client.commands.set(command.data.name, command));

//Function that runs when the bot is started
client.once(Discord.Events.ClientReady, async () => {
    try{
        console.log('Discord bot ready');
    } catch (error){
        console.error(error);
    }
})

//Function that is called when a command is submitted, and runs command.execute
client.on(Discord.Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isCommand()) {
            const commandName = interaction.commandName;
            const command = interaction.client.commands.get(commandName);

            if (!command){
                console.log(`Command "${commandName}" not found`);
                return;
            }
            command.execute(interaction);
        } else if (interaction.isAutocomplete()) {
            const commandName = interaction.commandName;
            const command = interaction.client.commands.get(commandName);

            if (!command){
                console.log(`Command "${commandName}" not found`);
                return;
            }

            if (typeof command.autocomplete === 'function') {
                command.autocomplete(interaction);
            } else {
                console.log(`Command "${commandName}" does not support autocomplete`);
            }
        }
    } catch (error) {
        console.error(error);
    }
});

// Gets called when the Discord Bot joins a server
client.on('guildCreate', async guild => {
    console.log(`Joined new server: ${guild.name} (ID: ${guild.id})`);
    try {
        // Fetch guild channels
        await guild.channels.fetch();

        // Find the first text channel
        const firstTextChannel = guild.channels.cache.find(channel => channel instanceof Discord.TextChannel);

        // Get ID of the first text channel if it wasn't null
        const firstTextChannelId = firstTextChannel ? firstTextChannel.id : null;

        // Data to be sent in POST request
        const data = {
            guild: guild.id,
            channel: firstTextChannelId,
            password: password
        };

        // Send a POST request to the server
        const response = await fetch(`${origin}/add-server`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        console.log('Server response:', response.status);
    } catch (error) {
        console.error('Error sending POST request:', error.message);
    }
});

// Gets called when the Discord Bot leaves a server
client.on('guildDelete', async guild => {
    console.log(`Left server: ${guild.name}, ID: ${guild.id}`);
    try {

        // Get the guildId of the server the Discord Bot left
        const params = { guild: guild.id, password: password };

        // Send a DELETE request to the server
        const response = await fetch(`${origin}/remove-server?${new URLSearchParams(params)}`, { 
            method: 'DELETE'
        });

        console.log('Server response:', response.status);
    } catch (error) {
        console.error('Error sending DELETE request:', error.message);
    }
});





      
      
/**
 * Enable commands for a guild
 * @param {string} guildId The ID of the guild
 * @param {Array} commands Array of command names to enable
 */
 async function enableCommands(guildId, commands) {
    try {
        console.log("Enabling commands for guild:", guildId);

        // Fetch current guild commands
        const guildCommands = await client.guilds.cache.get(guildId).commands.fetch();
        console.log("Guild commands:", guildCommands.map(command => command.name));

        // Fetch all available commands
        const availableCommands = await get_commands();

        // Filter commands that are either in guildCommands or in commands parameter
        const matchingCommands = availableCommands.filter(command => {
            // Check if the command is in guildCommands or in commands parameter
            return guildCommands.some(guildCommand => guildCommand.name === command.data.name) || commands.includes(command.data.name);
        });
        console.log("Enabling commands:", matchingCommands.map(command => command.data.name), " for guild:", guildId);

        // Register the matching commands for the guild
        await register_guild_commands(guildId, matchingCommands);
        console.log("Commands enabled for guild:", guildId);
    } catch (error) {
        console.error('Error enabling commands:', error);
    }
}

/**
 * Disable commands for a guild
 * @param {string} guildId The ID of the guild
 * @param {Array} commands Array of command names to disable
 * @returns 
 */
async function disableCommands(guildId, commands) {
    try {

        console.log('Disabling commands for guild:', guildId);
        
        // Fetch guild
        const guild = await client.guilds.fetch(guildId);
        // Get enabled commands for the guild
        const guildCommands = await guild.commands.fetch();

        // Get commands that are both in guildCommands and in commands parameter
        const matchingCommands = guildCommands.filter(command => command && commands.includes(command.name));

        // Delete the matching commands
        await Promise.all(matchingCommands.map(async command => {
            // Delete the command, only for the specific guild
            await guild.commands.delete(command.id, guild.id);
            console.log(`Command ${command.name} disabled for guild ${guild.id}`);
        }));
    } catch (error) {
        console.error('Error disabling commands: ', error);
        return;
    }
}

/**
* Function to send a message to Discord
* @param {string} embed - The embed to send
* @returns {Promise<void>}
*/
async function sendEmbedToDiscord(channelID, embed) {
    try {
        const channel = await client.channels.fetch(channelID);
        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending message to Discord:', error);
    }
}
            
//Start bot with discord token
client.login(token);

export { sendEmbedToDiscord, disableCommands, enableCommands}