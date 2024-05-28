import fetch from 'node-fetch';
import { guildIsInDB } from '../database/database.js';
import { promisify } from 'util';

/**
 * Get user data for a specific user
 * @param {string} auth The user's access token
 * @returns {Promise<{globalName: string, avatarURL: string}>} A promise that resolves to the user's Discord name and avatar URL
 */
export async function getUserData(auth){
  // Get user data through Discord API with their access token
  let userData = await (await fetch('https://discord.com/api/users/@me', {
    headers: {
      authorization: `${auth.token_type} ${auth.access_token}`,
    }
  })).json();

  
  const globalName = userData.global_name;
  let avatarURL;

  // Get the avatar URL, if it was null then set it to the standard Discord user logo.
  if(userData.avatar === null){
      avatarURL = '/public/assets/discord_logo.png';
  } else {
      avatarURL = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}`;
  }

  // Return username and avatar URL
  return [globalName, avatarURL];
}

/**
 * Get the guilds which the user is administrator on
 * @param {string} auth The user's access token
 * @returns {Promise<Array<{id: number, name: string, icon: string}>>} A promise that resolves to an array of guilds where each guild is an object with id, name and icon
 */
export async function getAdminGuilds(auth){
  // Fetch the guilds that the user is a member of using Discord's API
  let userGuilds = await (await fetch('https://discord.com/api/users/@me/guilds', {
    headers: {
      authorization: `${auth.token_type} ${auth.access_token}`,
    }
  })).json(); // Turn it into JSON

  // Filter the guilds where the user has the admin permission
  let adminGuilds = userGuilds
  .filter(guild => guild['permissions'] == 2147483647) // The admin permission
  .map(guild => {
    let icon = guild.icon === null ? 
    '/public/assets/discord_logo.png':
    `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`; // Map the icons using the API

    return {id: guild.id, name: guild.name, icon: icon} // Return the found guilds
  });

  return adminGuilds;
}

/**
 * Call the getAdminGuilds, if it fails retry. (Discord is not happy if you try to fetch from their API multiple times in a short amount of time)
 * @param {string} auth The user's access token
 * @param {number} retries Max number of retries, default 3
 * @param {number} delay Delay between each retry in MS, default 2000 (2s)
 * @returns {Promise<Array<{id: number, name: string, icon: string}>>} A promise that resolves to an array of guilds where each guild is an object with id, name and icon
 */
export async function getGuildsRetry (auth, retries = 3, delay = 2000) {
  try {
    // Try to get the guilds where the user is admin
    return await getAdminGuilds(auth);
  } catch (error) {
    // Check if we have any retries left
    if (retries === 0) {
      throw new Error('Failed to fetch guilds even after retries');
    }

    // Print error
    console.error('Error fetching guilds:', error.message);
    console.log(`Retrying after ${delay / 1000} seconds...`);

    // Await the delay and then try again
    await promisify(setTimeout)(delay);
    return await getGuildsRetry(auth, retries - 1, delay);
  }
};

/**
 * From an array of guilds, get only the ones in/not in the database.
 * @param {Array} guilds An array of guilds.
 * @param {boolean} enabled If true includes the guilds in the database, otherwise includes the ones not in the database.
 * @returns {Promise<Array<{id: number, name: string, icon: string}>>} A promise that resolves to an array of guilds where each guild is an object with id, name and icon
 */
export async function getGuildsEnabledDisabled(guilds, enabled) {
  // Check if each guild is in the database
  try {    
    const filteredGuilds = await Promise.all(guilds.map(async (guild) => {
      // If enabled is true then we return the ones in the database, vice versa if enabled is false.
      if (enabled) {
        if ((await guildIsInDB(guild.id))) {
          return guild;
        }
      } else {
        if (!(await guildIsInDB(guild.id))) {
          return guild;
        }
      }      
    }));

    // Filter out the guilds that are undefined
    const resultGuilds = filteredGuilds.filter(guild => guild !== undefined);

    // Return the resulting array of guilds
    return resultGuilds;
  } catch (error) {
    // Handle errors
    console.error("getGuildsEnabledDisabled:", error.message);
    return(null);
  }
}

/**
 * Returns all text channels on a Discord guild as a promise. The discord bot must be a member of that guild.
 * @param {number} guildId - The ID of the guild 
 * @param {string} botAccessToken 
 * @returns {Promise<Array<{id: number, name: string}>>} A promise that resolves to an array of text channel where each channel is an object with an id and a name
 */
export async function getAllTextChannels(guildId, botAccessToken) {
  // Fetch channels using bot, will return "unauthorized" if the bot is not in the guild
  try {
    const response = await fetch(`https://discord.com/api/v9/guilds/${guildId}/channels`, {
      headers: {
        'Authorization': `Bot ${botAccessToken}`
      }
    });

    // If we didn't successfully retreive the channels
    if (!response.ok) {
      throw new Error(`Error getting channels: ${response.status}`);
    }

    // Convert to JSON
    const channels = await response.json();

    // Filter out text channels
    const textChannels = channels
    .filter(channel => channel.type === 0) // Channel type 0 is text channel
    .map(channel => {
      return {id: channel.id, name: channel.name} // We are only interested in the ID and the name of the channel
    });

    return textChannels; // Return the text channel as an array of objects.
  } catch (error) {
    // Handle errors
    console.error('Error fetching channels:', error.message);
    throw error;
  }
}

/**
 * Checks whether a specific user is actually admin on a specific guild
 * @param {number} guildId The ID of the guild
 * @param {string} auth The user's access token
 * @returns {boolean} True if the user is admin, false otherwise
 */
export async function isUserAdmin(guildId, auth){
  try {
    // Get the guilds that the user is admin of
    const adminGuilds = await getGuildsRetry(auth);

    //Check if they are actually admin of the guild they tried to access.
    const match = adminGuilds.find((element) => element.id === guildId);
    if (match === undefined) {
      throw new Error();
    }

    // The user is admin of the guild, return true
    return(true);
  } catch (error) {

    // Either the user is not admin or some other issue happened, return false.
    return(false);
  }
}

/**
 * Checks whether the user is admin of the guild and the guild is in the database (combination of other functions)
 * @param {number} guildId The ID of the guild
 * @param {string} auth The user's access token
 * @returns {boolean} True if the user is admin AND the guild is in the database
 */
export async function adminAndGuildInDB(guildId, auth) {
  try {
    // Throw error if guild ID is undefined
    if (guildId === undefined) {
      throw new Error('Guild ID not defined');
    }

    // Check if the guild is in the database
    if (!(await guildIsInDB(guildId))){
      throw new Error(`Server ${guildId} is not in the database`);
    }

    // Check if the user is admin on the guild
    if (!(await isUserAdmin(guildId, auth))){
      throw new Error("User is not admin");
    }

    // Return true
    return true;
  } catch (error) {
    console.log("AdminAndGuildInDB: ", error.message);
    // If any error is caught, return false
    throw error; // Rethrow error for further handling
  }
}
