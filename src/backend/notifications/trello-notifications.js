import fetch from 'node-fetch';
import { getIntegrationId, getToken, getAllNotifications , getIntegrationSettings } from '../../database/database.js';
import dotenv from 'dotenv';
import { sendEmbedToDiscord } from '../discord-bot.js';
import { EmbedBuilder } from 'discord.js';
import { trelloNotifications } from './notifications-list.js';

dotenv.config();
const WEB_URL = process.env.SERVER_ORIGIN + "/trello-webhook";
const SECRET = process.env.SECRET;

/**
 * Get the Trello API key and token for a guild
 * @param {string} guildId The ID of the guild
 * @returns {Promise<[string, string, string]>} A promise that resolves to an array containing the API key and token
 */
async function getTrelloInfo(guildId) {
    try {
        const integrationId = await getIntegrationId(guildId, "trello");
        const orgId = await getToken(integrationId, "Organization ID");
        const apiKey = await getToken(integrationId, "API Key");
        const apiToken = await getToken(integrationId, "API Token");

        const settings = await getIntegrationSettings(guildId, "trello");
        const discordChannel = settings.discord_channel;

        return [orgId, apiKey, apiToken, discordChannel];
    } catch (error) {
        // Handle errors
        console.error("Error when getting trello keys from the database:", error.message);
        throw error;
    }
}

/**
 * Get all boards for an organization
 * @param {string} organizationId The ID of the organization
 * @param {string} apiKey The Trello API key
 * @param {string} apiToken The Trello API token
 * @returns {Promise<Array<{id: string, name: string, desc: string}>>} A promise that resolves to an array of boards
 */
async function getTrelloBoards(organizationId, apiKey, apiToken) {

    console.log("Getting boards");
    console.log("Organization ID:", organizationId);
    console.log("API Key:", apiKey);
    console.log("API Token:", apiToken);
    try {
        console.log("Getting boards");
        const response = await fetch(`https://api.trello.com/1/organizations/${organizationId}/boards?key=${apiKey}&token=${apiToken}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.status !== 200) {
            throw new Error(`Couldn't get boards, response: ${response.status}`);
        }

        const boards = await response.json();

        const mappedBoards = boards.map(board => {
            return { id: board.id, name: board.name, desc: board.desc};
        });

        return mappedBoards;
    } catch (error) {
        console.error("Unable to get boards, error:", error.message);
        return [];
    }
}

/**
 * Create a new Trello Webhook
 * @param {string} guildId ID of the guild which the webhook is for
 * @param {string} modelId ID of the model (board or list or card)
 */
async function createTrelloWebhook(guildId, modelId, apiKey, apiToken, boardName) {
    try {       
        // console.log("Creating webhook for board:", boardName);
        // console.log("Model ID:", modelId);
        // console.log ("API Key:", apiKey);
        // console.log("API Token:", apiToken);
        // console.log("Web URL:", WEB_URL);

        const response = await fetch(`https://api.trello.com/1/tokens/${apiToken}/webhooks/?key=${apiKey}&token=${apiToken}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                callbackURL: `${WEB_URL}?guildId=${guildId}&secretId=${SECRET}`,
                idModel: modelId
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.log('Error body:', errorBody);
            throw new Error(`Failed to create webhook: ${response.status} ${response.statusText} for ${boardName}`);
        }

        const responseData = await response.json();
        return responseData.id;
    } catch (error) {
        // Handle error
        console.error("createWebhook:", error.message);
        return null;
    }    
}

/**
 * Removes all trello webhooks for a guild
 * @param {string} guildId The ID of the guild
 */
async function removeAllTrelloWebhooks(guildId) {
    try {
        const [orgId, apiKey, apiToken] = await getTrelloInfo(guildId); // Only need the API key and token
        // Fetch all webhooks
        const response = await fetch(`https://api.trello.com/1/tokens/${apiToken}/webhooks?key=${apiKey}&token=${apiToken}`);
        if (!response.ok) {
            console.log("Couldn't get any webhooks, they likely don't exist:", response.status, response.statusText);
            return;
        }

        const webhooks = await response.json();

        // Delete each webhook
        await Promise.all(webhooks.map(async (webhook) => {
            const deleteResponse = await fetch(`https://api.trello.com/1/webhooks/${webhook.id}?key=${apiKey}&token=${apiToken}`, {
                method: 'DELETE'
            });

            if (!deleteResponse.ok) {
                throw new Error(`Failed to delete webhook ${webhook.id}: ${deleteResponse.status} ${deleteResponse.statusText}`);
            }
        }));
        console.log("All webhooks deleted");
    } catch (error) {
        // Handle errors
        console.error("Error deleting webhooks:", error.message);
        throw error; // Rethrow error for further handling
    }
}

/**
 * Create webhooks for all boards in an organization
 * @param {string} guildId The ID of the guild
 * @param {string} orgId The ID of the organization
 * @param {string} apiKey The Trello API key
 * @param {string} apiToken The Trello API token
 * @param {string} integrationId The ID of the integration
 * @returns {Promise<{createdWebhooks: Array<{webhookId: string, boardId: string}>, successBoards: Array<string>, failedBoards: Array<string>}>} A promise that resolves to an object containing the created webhooks, success boards and failed boards
 */
async function createTrelloWebhooks(guildId, orgId, apiKey, apiToken, integrationId) {

    let createdWebhooks = [];
    let successBoards = [];
    let failedBoards = [];
    try {
        const boards = await getTrelloBoards(orgId, apiKey, apiToken);

        await Promise.all(boards.map(async (board) => {
            const webhookId = await createTrelloWebhook(guildId, board.id, apiKey, apiToken, board.name);
            if (webhookId) {
                console.log("Webhook created for board:", board.name);
                createdWebhooks.push({ webhookId: webhookId, boardId: board.id });
                successBoards.push(board.name);
            } else {
                console.log("Failed to create webhook for board:", board.name);
                failedBoards.push(board.name);
            }
        }));

    } catch (error) {
        // Handle errors
        console.error("createTrelloWebhooks:", error.message);
    } finally {
        return {
            createdWebhooks: createdWebhooks,
            successBoards: successBoards,
            failedBoards: failedBoards
        };
    }
}

/**
 * Send a Trello event to Discord
 * @param {Object} event The Trello event
 * @param {string} guildId The ID of the guild
 */
async function sendTrelloEventToDiscord(event, guildId) {
    try {
        
        const integrationId = await getIntegrationId(guildId, "trello");

        const [orgId, apiKey, apiToken, discordChannel] = await getTrelloInfo(guildId);

        const enabledNotifications = await getAllNotifications(integrationId, "trello");

        if (!enabledNotifications || enabledNotifications.length === 0) {
            console.log("No notifications enabled for Trello for: " + guildId);
            return;
        }

        let type = event.action.type;
        
        event = event.action.data;
        let typeText = '';
        let fields = [];

        //console.log("Event data:", event);
        switch(type){
            case "createCard":
                type = "createCard";
                typeText = "Card created";
                fields = fieldsCard(event);
                break;
            case "updateCard":
                if (event.card.closed) {
                    type = "deleteCard";
                    typeText = "Card deleted";
                    fields = fieldsCard(event);
                } else if (event.listBefore) {
                    type = "moveCard";
                    typeText = "Card moved";
                    fields = fieldsCardMoved(event);
                } else if (event.old && event.old.idList) {
                    // Ignore this event because it's a card move event
                } else {
                    type = "updateCard";
                    typeText = "Card updated";
                    fields = fieldsCard(event);
                }
                break;
            case "createList":
                type = "createList";
                typeText = "List created";
                fields = fieldsList(event);
                break;
            case "updateList":
                if (event.list.closed) {
                    type = "deleteList";
                    typeText = "List deleted";
                    fields = fieldsList(event);
                } else {
                    type = "updateList";
                    typeText = "List updated";
                    fields = fieldsList(event);
                }
                break;
            default:
                console.log("Event type not recognized:", type);
                return;
        }
        //console.log(enabledNotifications);
        const isTypeEnabled = enabledNotifications.some(enabledNotification => {
            const matchingTrelloNotification = trelloNotifications.find(trelloNotification => trelloNotification.name === enabledNotification.name);
            return matchingTrelloNotification && matchingTrelloNotification.codename === type;
        });
        if (!isTypeEnabled) {
            console.log("Notification type not enabled:", type);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Trello Notification')
            .setDescription(typeText)
            .addFields(fields)
            .setThumbnail('https://cdn.iconscout.com/icon/free/png-256/trello-3-569395.png')
            .setTimestamp()
            .setColor('#0079BF');
        await sendEmbedToDiscord(discordChannel, embed);
        
    } catch (error) {
        console.error("sendTrelloToDiscord:", error.message);
    }
}

/**
 * Adds fields to the embed based on the event type
 * @param {Object} event The Trello event
 * @returns {Array<{name: string, value: string, inline: boolean}>} An array of fields
 */
function fieldsCard(event) {
let fields = [];
fields.push({name: 'Card:', value: event.card.name});
if (event.card.desc) {
    fields.push({name: 'Description:', value: event.card.desc, inline:true});
}
fields.push({name: 'Board:', value: event.board.name});
return fields;
}

/**
 * Adds fields to the embed based on the event type
 * @param {Object} event The Trello event
 * @returns {Array<{name: string, value: string, inline: boolean}>} An array of fields
 */
function fieldsCardMoved(event) {
    let fields = [];
    fields.push({name: 'Card:', value: event.card.name});
    if (event.card.desc) {
        fields.push({name: 'Description:', value: event.card.desc, inline:true});
    }
    fields.push({name: 'List before:', value: event.listBefore.name, inline: true});
    fields.push({name: 'List after:', value: event.listAfter.name, inline: true});
    fields.push({name: 'Board:', value: event.board.name});
    return fields;
}

/**
 * Adds fields to the embed based on the event type
 * @param {Object} event The Trello event
 * @returns {Array<{name: string, value: string, inline: boolean}>} An array of fields
 */
function fieldsList(event) {
    let fields = [];
    fields.push({name: 'List:', value: event.list.name});
    fields.push({name: 'Board:', value: event.board.name});
    return fields;
}

export { getTrelloInfo, getTrelloBoards, createTrelloWebhook, removeAllTrelloWebhooks, createTrelloWebhooks, sendTrelloEventToDiscord}