// Require google from googleapis package
import { google } from 'googleapis'
import dotenv from 'dotenv'
import { EmbedBuilder } from 'discord.js';
import { sendEmbedToDiscord } from '../discord-bot.js';
import { getIntegrationId, getToken, editSyncTokenGoogleCalendar, getGoogleWebhook, saveGoogleCalendarWebhook, getAllNotifications, getIntegrationSettings } from '../../database/database.js';
import { v4 as uuidv4 } from 'uuid';
import { googleNotifications } from './notifications-list.js';

// Require oAuth2 from our google instance to authenticate
const { OAuth2 } = google.auth

// Allow us to get data from our .env file
dotenv.config();
const WEB_URL = process.env.SERVER_ORIGIN + "/google-webhook";
const SECRET = process.env.SECRET;

/**
 * Retrieves the Google Calendar information from the database.
 * @param {string} guildId - The ID of the guild.
 * @returns {Promise<Array<string>>} A promise that resolves to an array containing the Google Calendar information.
 */
async function getGoogleCalendarInformation(guildId) {
  try {
      const integrationId = await getIntegrationId(guildId, "googlecalendar");
      const clientId = await getToken(integrationId, "Client ID");
      const secretId = await getToken(integrationId, "Client Secret");
      const tokenId = await getToken(integrationId, "Token");
      const calendarId = await getToken(integrationId, "Calendar ID");

      const settings = await getIntegrationSettings(guildId, "googlecalendar");
      const discordChannel = settings.discord_channel;

      const oAuth2Client = new OAuth2(
        clientId,
        secretId,
        WEB_URL
    )
    // Set the refresh token
    oAuth2Client.setCredentials({
      refresh_token: tokenId,
    })
      return [calendarId, oAuth2Client, discordChannel];
  } catch (error) {
      // Handle errors
      console.error("Error when getting google calendar keys from the database:", error);
      throw error;
  } 
}

/**
 * Retrieves the resource information from the database.
 * @param {string} integrationId - The ID of the integration.
 * @returns {Promise<Array<string>>} A promise that resolves to an array containing the resource information.
 */
async function getResource(integrationId) {
  const result = await getGoogleWebhook(integrationId);

  if (result.length > 0) {
    const {channel_id: channelId, resource_id: resourceId, synctoken: synctoken} = result[0];
  return [channelId, resourceId, synctoken];
}
  return [];
}

/**
 * Sets up a webhook to receive notifications.
 * @param {string} guildId - The ID of the guild.
 * @param {string} clientId - The client ID for the Google Calendar API.
 * @param {string} secretId - The client secret for the Google Calendar API.
 * @param {string} tokenId - The refresh token for the Google Calendar API.
 * @param {string} calendarId - The ID of the Google Calendar.
 */
const createGoogleWebhook = async (guildId, clientId, secretId, tokenId, calendarId) => {

  const integrationId = await getIntegrationId(guildId, "googlecalendar");
  
  const oAuth2Client = new OAuth2(
    clientId,
    secretId,
    WEB_URL
  )
  oAuth2Client.setCredentials({
    refresh_token: tokenId,
  })

  console.log('Creating watch');
  console.log('calendarId: ' + calendarId);
  console.log('oAuth2Client: ' + oAuth2Client);
  console.log('WEB_URL: ' + WEB_URL);
  console.log('SECRET: ' + SECRET);
  console.log('token: ' + tokenId);
  const calendarEvent = google.calendar({ version: 'v3', auth: oAuth2Client });
  const id = uuidv4();
  try {
    const res = await calendarEvent.events.watch({
      calendarId: calendarId,
      resource: {
        id: id,
        type: 'web_hook',
        address: `${WEB_URL}?guildId=${guildId}`,
        secret: SECRET,
      },
    });
    console.log('Created watch', res.data.resourceId);

    const webhooks = await saveGoogleCalendarWebhook(guildId, id, res.data.resourceId, res.data.resourceUrl);
    if (webhooks.length > 0) {
      await removeGoogleWebhook(guildId);
    }

    await editSyncTokenGoogleCalendar(integrationId, null); 

    console.log('Fetching events');
    await getGoogleEvents(guildId);
  }
  catch (error) {
    console.log(error);
    console.error('Failed to create watch', error.message);
  }
};

/**
 * Removes the webhook for receiving notifications.
 * @param {string} guildId - The ID of the guild.
 */
const removeGoogleWebhook = async (guildId) => {
  const integrationId = await getIntegrationId(guildId, "googlecalendar");
  const [calendarId, oAuth2Client, discordChannel] = await getGoogleCalendarInformation(guildId);
  const [channelId, resourceId, synctoken] = await getResource(integrationId);

  const calendarEvent = google.calendar({ version: 'v3', auth: oAuth2Client });

  try {
    const res = await calendarEvent.channels.stop({
      requestBody: {
        id: channelId,
        resourceId: resourceId,
      },
    });
    console.log('Removed watch', res.data);
  }
  catch (error) {
    console.error('Failed to remove watch', error);
  }
}

/**
 * Fetches events from the Google Calendar and processes them. and sends them to Discord.
 * @returns {Promise<void>} A promise that resolves when the events are fetched and processed successfully.
 */
async function getGoogleEvents(guildId) {

  const integrationId = await getIntegrationId(guildId, "googlecalendar");
  const [calendarId, oAuth2Client, discordChannel] = await getGoogleCalendarInformation(guildId);
  const [channelId, resourceId, synctoken] = await getResource(integrationId);
  const calendarEvent = google.calendar({ version: 'v3', auth: oAuth2Client });


  const params = {
    calendarId: calendarId,
    singleEvents: true,
  };

  if (synctoken) {
    params.syncToken = synctoken;
  }

  try {
    // Fetch the events from the Google Calendar and edit the sync token
    const events = await calendarEvent.events.list(params);

    // Edit the sync token
    await editSyncTokenGoogleCalendar(integrationId, events.data.nextSyncToken); 

    if (!events.data.items) {
      console.error('No events found');
      return;
    }
    if (events.data.items.length !== 1) {
      console.error('Unexpected number of events', events.data.items.length);
      return;
    }

    const element = events.data.items[0];
    // Determine the type of event by comparing the created and updated timestamps
    let eventType = 'deleted';
    if (element.status !== 'deleted') {
      const created = new Date(element.created).getTime();
      const updated = new Date(element.updated).getTime();
  
      const createdSeconds = Math.floor(created / 1000); 
      const updatedSeconds = Math.floor(updated / 1000);
  
      eventType = createdSeconds === updatedSeconds ? 'created' : 'updated';
    }
    // fetch information about the notifications and if any send to discord
    const intergrationId = await getIntegrationId(guildId, 'googlecalendar');
    const enabledNotifications = await getAllNotifications(intergrationId, 'googlecalendar');

    if (!enabledNotifications || enabledNotifications === 0){
      console.log('No notifications enabled for googlecalendar')
      return
    }
    
    const type = 'google-calendar-event-' + eventType;

    Promise.all(googleNotifications.map(async notification => {
      if (notification.codename === type && enabledNotifications.some(n => n.name === notification.name)){
        console.log('Sending notification to discord');
        await sendGoogleCalendarToDiscord(element, eventType, discordChannel);
      }
    }));

  }
  catch (error) {
    if (error.code === 410) {
      console.log('Resyncing data');
      synctoken = null;
      await getGoogleEvents(guildId);
    }
    throw error;
  }
};

/**
 * Creates an embed message for a Google Calendar event and sends it to Discord.
 * @param {Object} element - The Google Calendar event object.
 * @param {string} type - The type of event ('created', 'updated', 'deleted').
 */
async function sendGoogleCalendarToDiscord(element, type, discordChannel) {
  try {

    let embedSummary = element?.summary;
    let embedDesc = element?.description || 'No description provided';
    let embedURL = element?.htmlLink
    let embedColor = '#800080'
    let eventDate = new Date(element.start.dateTime || element.start.date);
    
    // Define the fields for the embed message
    let fields = [];

      // switch case to determine the type of event and push the appropriate fields to the embed
      switch(type){
        case 'created':
        case 'updated':
          fields.push(
            {name: 'Title', value: embedSummary},
            {name: 'Description', value: embedDesc},
            {name: 'Date', value: eventDate.getFullYear() + '-' + (eventDate.getMonth() + 1).toString().padStart(2, '0') + '-' + eventDate.getDate().toString().padStart(2, '0'), inline: true},
          )
          // Check if the event is a full-day event or not
          if (element.start.dateTime) {
            fields.push( {name: 'Time', value: eventDate.getHours().toString().padStart(2, '0') + ':' + eventDate.getMinutes().toString().padStart(2, '0'), inline: true},);
          } else {
            fields.push({name: 'Time', value: 'Full-day event', inline: true})
          }
          break;
        case 'deleted':
          embedSummary = 'Event deleted'
          embedURL = null
          embedColor = '#FFA500' // orange

          fields.push(
            {name: 'Title', value: embedSummary}
          )
          break;
        default:
          embedSummary = 'Error: Event type not recognized'
          embedColor = '#FF0000' // red
          embedURL = null
          break;
      }
       
      const embed = new EmbedBuilder()
        .setTitle('Google Calendar Notification')
        .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/1024px-Google_Calendar_icon_%282020%29.svg.png')
        .setURL(embedURL)
        .setColor(embedColor)
        .setFields(fields);

      await sendEmbedToDiscord(discordChannel, embed);   //for testing purposes where it is sent to the test channel
    } catch (error) {
      console.log('failed to create embed: ' + error.message);
    }
}

export { sendGoogleCalendarToDiscord, createGoogleWebhook, getGoogleEvents, removeGoogleWebhook }


