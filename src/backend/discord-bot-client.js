import Discord from 'discord.js'

export const client = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds]});