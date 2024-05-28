// Import necessary modules and libraries
import dotenv from 'dotenv'
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { get_commands } from './get-commands.js'

// Load configuration from .env file and check if required environment variables are set
dotenv.config();
const requiredEnvVars = ['DISCORD_BOT_ID', 'DISCORD_BOT_TOKEN'];
checkEnvVars(requiredEnvVars);

/**
 * Check if required environment variables are set and exit the process if any are missing
 * @param {any} envVars 
 */
function checkEnvVars(envVars) {
    const missingVars = envVars.filter(varName => process.env[varName] === undefined);
    if (missingVars.length > 0) {
        console.error(`The following environment variables are missing: ${missingVars.join(', ')}`);
        process.exit(1);
    }
}

// Load configuration from .env file
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const BOT_ID = process.env.DISCORD_BOT_ID;

// Create a new REST client with the bot token and version 9 of the API
const rest = new REST({ version: '9' }).setToken(BOT_TOKEN);

/**
 * Register commands for a guild, based on guild id
 * @param {string} guild_id The id of the guild 
 * @param {Array} get_commands Commands to register
 */
export async function register_guild_commands(guild_id, commands){
	commands = commands.map(command => command.data.toJSON());
    try {
        const data = await rest.put(
            Routes.applicationGuildCommands(BOT_ID, guild_id),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} guild application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
}

/**
 * Register global commands (NOT CURRENTLY USED)
 * @param {any} get_commands 
 */
async function register_global_commands(get_commands){
    let commands = (await get_commands()).map(command => command.data.toJSON());

    try {
        const data = await rest.put(
            Routes.applicationCommands(BOT_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} global application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
}
export default{
	register_guild_commands,
	register_global_commands
}