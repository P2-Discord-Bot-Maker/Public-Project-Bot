
import dotenv from 'dotenv';
import { getIntegrationId, getToken } from '../../database/database.js';
import { sendEmbedToDiscord } from '../discord-bot.js';
import { EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { getAllNotifications, getIntegrationSettings } from '../../database/database.js';
import { githubNotifications } from './notifications-list.js';

dotenv.config();

const WEB_URL =  process.env.SERVER_ORIGIN + "/github-webhook";
const SECRET = process.env.SECRET;
/**
 * Get the Github API token and organization name from the database
 * @param guildId - The ID of the guild
 * @returns {Promise<[string, string]>} - The API token and organization name
 */
async function getGithubInfo(guildId) {
    try {
        const integrationId = await getIntegrationId(guildId, "github");
        const apiToken = await getToken(integrationId, "Token");
        const org = await getToken(integrationId, "Organization");

        const settings = await getIntegrationSettings(guildId, "github");
        const discordChannel = settings.discord_channel;

        return [apiToken, org, discordChannel];
    } catch (error) {
        // Handle errors
        console.error("Error when getting github keys from the database:", error);
        throw error;
    }
}

/**
 * Create a webhook for an organization
 * @returns {Promise<unknown>} - The response from the API
 */
async function createGithubWebhook(guildId, org, apiToken) {

    const url = `https://api.github.com/orgs/${org}/hooks`;
    const config = {
        headers: {
            Authorization: `token ${apiToken}`,
            Accept: 'application/vnd.github.v3+json'
        }
    };

    // Check if webhook already exists
    try {
        const response = await axios.get(url, config);
        const existingWebhook = response.data.find(hook => hook.config.url === WEB_URL);
        // If the webhook already exists, return
        if (existingWebhook) {
            console.log('Webhook already exists:', existingWebhook);
            return;
        }
    // Error handling
    } catch (error) {
        console.error('Error getting webhooks:', error.response ? error.response.data : error.message);
        return;
    }

    // Create new webhook
    const data = {
        name: 'web',
        config: {
            url: `${WEB_URL}?guildId=${guildId}`,
            content_type: 'json',
            secret: SECRET,
        },
        events: '*', // Listen for all events
        active: true
    };
    // Create the webhook
    try {
        const response = await axios.post(url, data, config);
        console.log('Webhook created:', response.data);
    } catch (error) {
        console.error('Error creating webhook:', error.response ? error.response.data : error.message);
    }
}

/**
 * Delete a webhook for an organization
 * @param org - The name of the organization
 * @param webhookUrl - The URL of the webhook
 * @returns {Promise<unknown>} - The response from the API
 */
async function removeGithubWebhook(guildId) {

    const [apiToken, org] = await getGithubInfo(guildId);

    const url = `https://api.github.com/orgs/${org}/hooks`;
    const config = {
        headers: {
            Authorization: `token ${apiToken}`,
            Accept: 'application/vnd.github.v3+json'
        }
    };

    // Find the webhook to delete
    let webhookId;
    try {
        const response = await axios.get(url, config);
        const webhook = response.data.find(hook => hook.config.url === WEB_URL);
        if (!webhook) {
            console.log('Webhook not found:', WEB_URL);
            return;
        }
        webhookId = webhook.id;
    // Error handling
    } catch (error) {
        console.error('Error getting webhooks:', error.response ? error.response.data : error.message);
        return;
    }

    // Delete the webhook
    try {
        await axios.delete(`${url}/${webhookId}`, config);
        console.log('Webhook deleted:', webhookId);
    } catch (error) {
        console.error('Error deleting webhook:', error.response ? error.response.data : error.message);
    }
}

/**
 * Send a Github event to Discord
 * @param eventType - The type of event
 * @param event - The event data
 * @param guildId - The ID of the guild
 * @returns {Promise<void>}
 */
async function sendGithubEventToDiscord(eventType, event, guildId) {
    try {

        const integrationId = await getIntegrationId(guildId, "github");
        const [apiToken, org, discordChannel] = await getGithubInfo(guildId);
        
        // Check if the client exists
        if (!integrationId) {
            console.error('Client not found');
            return;
        }
        // fetch enabled notifications any exists
        const enabledNotifications = await getAllNotifications(integrationId, "github");
        if (!enabledNotifications || enabledNotifications.length === 0) {
            console.log("No notifications enabled for Github for: " + guildId);
            return;
        }

        // Convert the event type to a codename
        const type = eventTypeToCodename[eventType];
        const fields = (eventTypeToFields(eventType, event) || []).map(field => ({
            ...field,
            value: String(field.value)
          }));
        if (fields.length === 0) {
            console.log('Unknown event type:', eventType);
            return;
        }
        let isTypeEnabled = false;
        // Check if the notification type is enabled
        githubNotifications.forEach(notification => {
            if (notification.codename === type && enabledNotifications.some(n => n.name === notification.name)){
              console.log('Sending notification to discord');
              isTypeEnabled = true;
              return;
            }
          });

        if (!isTypeEnabled) {
            console.log("Notification type not enabled:", type);
            return;
        }

        // Send the event to Discord
        const embed = new EmbedBuilder()
            .setTitle('Github Notification')
            .setDescription(`A new Github event has occurred: ${type.toString()}`)
            .addFields(fields)
            .setThumbnail('https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png')
            .setTimestamp()
            .setColor('#0079BF');
        await sendEmbedToDiscord(discordChannel, embed);
        
    } catch (error) {
        console.error("sendGithubToDiscord:", error);
    }
}

// Mapping of Github event types to notification codenames
const eventTypeToCodename = {
    'push': 'github-push',
    'pull_request': 'github-pull-request',
    'release': 'github-release',
    'discussion': 'github-discussions',
    'create': 'github-branch',
    'commit_comment': 'github-commit',
    'deployment': 'github-deployment',
    'deployment_status': 'github-deployment-status',
    'member': 'github-member',
    'pull_request_review': 'github-pull-request-review',
    'pull_request_review_comment': 'github-pull-request-review-comment',
};

/**
 * Convert a Github event to an array of fields
 * @param type - The type of event
 * @param event - The event data
 * @returns {[]} - An array of fields
 */
const eventTypeToFields = (type, event) => {
    console.log('Type:', type);
    let fields;
    switch (type) {
        case 'deployment':
            fields = [
                { name: 'Repository', value: event.repository.full_name, inline: true },
                { name: 'Deployment', value: event.deployment.environment, inline: true },
                { name: 'Action', value: event.action, inline: true },
            ];
            break;
        case 'deployment_status':
            fields = [
                { name: 'Repository', value: event.repository.full_name, inline: true },
                { name: 'Deployment', value: event.deployment.environment, inline: true },
                { name: 'Status', value: event.deployment_status.state, inline: true },
            ];
            break;
        case 'member':
            fields = [
                { name: 'Repository', value: event.repository.full_name, inline: true },
                { name: 'Member', value: event.member.login, inline: true },
                { name: 'Action', value: event.action, inline: true },
            ];
            break;
        case 'pull_request_review':
            fields = [
                { name: 'Repository', value: event.repository.full_name, inline: true },
                { name: 'Pull Request', value: event.pull_request.title, inline: true },
                { name: 'Action', value: event.action, inline: true },
            ];
            break;
        case 'pull_request_review_comment':
            fields = [
                { name: 'Repository', value: event.repository.full_name, inline: true },
                { name: 'Pull Request', value: event.pull_request.title, inline: true },
                { name: 'Comment', value: event.comment.body, inline: true },
            ];
            break;
        case 'push':
            fields = [
                { name: 'Repository', value: event.repository.full_name, inline: true },
                { name: 'Pusher', value: event.pusher.name, inline: true },
                { name: 'Commits', value: event.commits.length, inline: true },
            ];
            break;
        case 'pull_request':
            fields = [
                { name: 'Repository', value: event.repository.full_name, inline: true },
                { name: 'Pull Request', value: event.pull_request.title, inline: true },
                { name: 'Action', value: event.action, inline: true },
            ];
            break;
        case 'release':
            fields = [
                { name: 'Repository', value: event.repository.full_name, inline: true },
                { name: 'Release', value: event.release.tag_name, inline: true },
                { name: 'Action', value: event.action, inline: true },
            ];
            break;
        case 'discussion':
            fields = [
                { name: 'Repository', value: event.repository.full_name, inline: true },
                { name: 'Discussion', value: event.discussion.title, inline: true },
                { name: 'Action', value: event.action, inline: true },
            ];
            break;
        case 'create':
            fields = [
                { name: 'Repository', value: event.repository.full_name, inline: true },
                { name: 'Ref', value: event.ref, inline: true },
                { name: 'Ref Type', value: event.ref_type, inline: true },
            ];
            break;
        case 'commit_comment':
            fields = [
                { name: 'Repository', value: event.repository.full_name, inline: true },
                { name: 'Commit', value: event.comment.commit_id, inline: true },
                { name: 'Comment', value: event.comment.body, inline: true },
            ];
            break;
        default:
            fields = [];
    }
    return fields;
};

export {createGithubWebhook, removeGithubWebhook, sendGithubEventToDiscord };