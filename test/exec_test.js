import { connectToMySQL, addNewGuild, getIntegrationId, editToken } from '../src/database/database.js';

/**
 * The following code can be used to run and add the necessary information to the database.
 */

let integrationId;

const GUILD = {
    id: process.env.DISCORD_GUILD_ID
};

    // Connect to MySQL server
await connectToMySQL();
// await addNewGuild(GUILD.id);

    // GitHub
// integrationId = await getIntegrationId(GUILD.id, "github");
// await editToken("tokens", integrationId, "Token", { key: process.env.GITHUB_TOKEN });

    // Google Calendar
// integrationId = await getIntegrationId(GUILD.id, "googlecalendar");
// await editToken("tokens", integrationId, "Calendar ID", { key: process.env.CALENDAR_P2ID });
// await editToken("tokens", integrationId, "Client ID", { key: process.env.CALENDAR_CLIENT_ID });
// await editToken("tokens", integrationId, "Client Secret", { key: process.env.CALENDAR_SECRET_ID });
// await editToken("tokens", integrationId, "Token", { key: process.env.CALENDAR_TOKEN_ID });

    // Trello
// integrationId = await getIntegrationId(GUILD.id, "trello");
// await editToken("tokens", integrationId, "API Key", { key: process.env.TRELLO_API });
// await editToken("tokens", integrationId, "API Token", { key: process.env.TRELLO_TOKEN });
// await editToken("tokens", integrationId, "Organization ID", { key: process.env.TRELLO_ORGANIZATION_ID });