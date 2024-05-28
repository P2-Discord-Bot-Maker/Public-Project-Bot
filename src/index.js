import express from 'express';
import fetch from 'node-fetch';
import { URLSearchParams, fileURLToPath } from 'url';
import path from 'path';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv'
import assert from 'assert';
import { readFile } from 'fs/promises';
import { marked } from 'marked';
import { validationResult } from 'express-validator';
import { getUserData, getGuildsEnabledDisabled, getAllTextChannels, getGuildsRetry, isUserAdmin, adminAndGuildInDB } from './utils/discord-api.js';
import { connectToMySQL, addNewGuild, guildIsInDB, removeGuild, getIntegrationSettings, editIntegration, editToken, getIntegrationId, getTokens, addService, removeService, clearTokens, removeNotification, addNewNotification,  getGoogleWebhook } from './database/database.js';
import { enableCommands, disableCommands } from './backend/discord-bot.js';
import { get_commands } from './backend/get-commands.js';
import { createTrelloWebhooks, getTrelloBoards, getTrelloInfo, removeAllTrelloWebhooks, sendTrelloEventToDiscord } from './backend/notifications/trello-notifications.js';
import { guildValidation, channelValidation, integrationValidation, serviceTypeValidation, tokensValidation, servicesValidation, serviceValidation } from './validationRules.js';
import { getGoogleEvents , removeGoogleWebhook , createGoogleWebhook } from './backend/notifications/googlecalendar-notifications.js';
import { createGithubWebhook, sendGithubEventToDiscord, removeGithubWebhook } from './backend/notifications/github-notifications.js';
import crypto from 'crypto';
import { trelloNotifications, githubNotifications, googleNotifications } from './backend/notifications/notifications-list.js';

// Create an express app
const app = express();
const port = 3000;

// Use cookie parser
app.use(cookieParser());

// Use JSON
app.use(express.json());

// Connect to the MySQL DB
await connectToMySQL()

// Loads token from .env file
dotenv.config();

// Discord OAuth2 configuration CHANGE THIS AND DELETE IT
var config = {
  "origin": process.env.SERVER_ORIGIN,
  "clientId": process.env.DISCORD_BOT_ID,
  "clientSecret": process.env.DISCORD_BOT_CLIENT_SECRET,
  "redirectUri": `${process.env.SERVER_ORIGIN}/auth/discord/callback`,
  "clientToken": process.env.DISCORD_BOT_TOKEN,
  "secret": process.env.SECRET
}

// Ensure that clientId and clientSecret are defined.
assert(config['origin'] !== undefined, "SERVER_ORIGIN missing from .env file");
assert(config['clientId'] !== undefined, "DISCORD_BOT_ID missing from .env file");
assert(config['clientSecret'] !== undefined, "DISCORD_BOT_CLIENT_SECRET missing from .env file");

// Serve static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set EJS as the default view engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/' + 'views');

// Serve the public folder
app.use(express.static(__dirname));

// Login required custom middleware
const loginRequired = async (req, res, next) => {
  // Check if the auth cookie is undefined, if it is the user is not logged in
  if (req.cookies['auth'] === undefined) {
    res.redirect('/auth/discord/login')
  }
  else { 
    // Get user data from the users authentication cookie
    let [username, avatarURL] = await getUserData(req.cookies.auth);
    res.locals.username = username;
    res.locals.avatarURL = avatarURL;
    next();
  }
}

// Serve the index page
app.get('/', loginRequired, async (req, res) => {
  try {
    const data = await readFile('src/public/assets/guide.md', 'utf-8');
    const htmlContent = marked(data);
    res.render('guide', { content: htmlContent, title: "Token Guide" });
  } catch (error) {
    console.error("index:", error.message);
  }
});

// Redirect to Discord's OAuth2 page
app.get('/auth/discord', (req, res) => {
  console.log(config.redirectUri);
  res.redirect(`https://discord.com/oauth2/authorize?client_id=${config.clientId}&response_type=code&redirect_uri=${encodeURIComponent(config.redirectUri)}&scope=email+guilds+identify`);
});

// Redirect to Discord's OAuth2 page
app.get('/auth/discord/callback', (req, res) => {
  console.log('/auth/discord/callback called');
  var code = req.query.code;
  var params = new URLSearchParams();
  params.append("client_id", config.clientId);
  params.append("client_secret", config.clientSecret);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", config.redirectUri);
  fetch(`https://discord.com/api/oauth2/token`, {
    method: "POST",
    body: params
  })
  .then(res => res.json())
  .then(json => {
    res.cookie('auth', {token_type: json.token_type, access_token: json.access_token}, {expires: new Date(Date.now() + json.expires_in * 1000)});
    res.redirect('/');
  });
});

// Get the guilds the user is an administrator of
app.get('/auth/discord/administratorguilds', (req, res) => {
  
  fetch(`https://discord.com/api/users/@me/guilds`, {
    headers: {
      authorization: `${req.cookies.auth.token_type} ${req.cookies.auth.access_token}`,
    }
  })
  .then(res => res.json())
  .then(json => {
    res.json(json.filter(guild => guild['permissions_new'] == '562949953421311')); //Filters for servers where user is administrator
  });
})

// Get the user's data based on auth access_token
app.get('/auth/discord/getuserdata', async (req, res) => {

  //Get guilddata
  let userGuilds = await (await fetch(`https://discord.com/api/users/@me/guilds`, {
    headers: {
      authorization: `${req.cookies.auth.token_type} ${req.cookies.auth.access_token}`,
    }
  })).json();

  //Filters for servers where user is administrator and extracts id, name and icon
  let administratorguilds = userGuilds
  .filter(guild => guild['permissions_new'] == '562949953421311')
  .map(guild => {
    let icon = guild.icon === null ? 
    '/public/assets/discord_logo.png':
    `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;

    return {id: guild.id, name: guild.name, icon: icon}
  });

  //Get userdata
  let userData = await (await fetch('https://discord.com/api/users/@me', {
    headers: {
      authorization: `${req.cookies.auth.token_type} ${req.cookies.auth.access_token}`,
    }
  })).json();

  // set user avatar
  let avatarURL;
  if(userData.avatar == null){
    avatarURL = '/public/assets/discord_logo.png';
  } else {
    avatarURL = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}`;
  }
  const globalName = userData.global_name;
  res.send(`${avatarURL}, ${globalName}, ${btoa(JSON.stringify(administratorguilds))}`);
});

// Login
app.get('/auth/discord/login', (req, res) => {
  res.clearCookie('auth');
  res.sendFile(__dirname + '/public/html/login.html');
})

// Logout
app.get('/auth/discord/logout', (req, res) => {
  res.clearCookie('auth');
  res.redirect('/');
});

//Render the integration page with the necessary parameters
app.get('/integration', loginRequired, guildValidation, integrationValidation, async (req, res) => {
  try {
    // Check for validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      res.redirect('/');
      return Error(validationErrors.array().map(error => error.msg).join(', '));
    }

    // Destructure query parameters
    let { integration, guild } = req.query;
    const integrationName = integration.toLowerCase().replace(/\s/g, '');

    // Authorization check
    if (!(await adminAndGuildInDB(guild, req.cookies.auth))) {
      throw new Error(`User ${res.locals.username} is not admin or ${guild} does not exist`);
    }

    // Get the settings for the integration
    const settings = await getIntegrationSettings(guild, integrationName);
    if (settings === null) {
      throw new Error("Could not get settings");
    }

    const channels = await getAllTextChannels(guild, config.clientToken);

    // Render the page using the settings
    res.render('integration', { title: integration, settings, channels });
  } catch (error) {
   
    console.error("/integration:", error.message);
    
    res.redirect('/');
  }
});

// Called from the Discord Bot when it joins a new server
// validate new server and add it to the database
app.post('/add-server', guildValidation, channelValidation, async (req, res) => {
  try {
    console.log('/add-server called');

    // Extract the guild and channel from the request body
    const { guild, channel, password } = req.body;

    console.log('Guild:', guild);
    console.log('Channel:', channel);

    // Check for validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {

      // If there are validation errors, throw an error
      throw new Error(validationErrors.array().map(error => error.msg).join(', '));
    }

    if (String(password) !== process.env.SERVER_PASSWORD) {
      throw new Error(`Somebody tried to add a server ${guild} without the correct password`);
    }
    // Call the function to add the server to the database
    await addNewGuild(guild, channel);

    // Respond with OK
    res.sendStatus(200);
  } catch (error) {
    console.error('Error adding new server:', error.message);
    res.status(500).send('Error adding new server');
  }
});

// Called from the Discord Bot when it leaves a discord server
// validate the server and remove it from the database
app.delete('/remove-server', guildValidation, async (req, res) => {
  try {
    console.log('/remove-server called');
    // Check for validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      // If there are validation errors, throw an error
      throw new Error(validationErrors.array().map(error => error.msg).join(', '));
    }

    // Get the guild from the request body
    const { guild, password } = req.query;

    if (!String(password) === process.env.SERVER_PASSWORD) {
      throw new Error(`Somebody tried to remove a server ${guild} without the correct password`);
    }

    await removeAllTrelloWebhooks(guild); // Remove existing webhooks

    // Call the function to remove the server from the database
    await removeGuild(guild);

    // Respond with OK
    res.sendStatus(200); 
  } catch (error) {
    console.error('Error removing server:', error.message);
    res.status(500).send('Error removing server');
  }
});

// Get called when the user changes the default discord channel dropdown
// validate the channel and update the database
app.patch('/change-channel', guildValidation, integrationValidation, channelValidation, async (req, res) => {
  try {
    // Check for validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      // If there are validation errors, throw an error
      throw new Error(validationErrors.array().map(error => error.msg).join(', '));
    }

    // Get integration and guild
    let { integration, guild, channel } = req.body;
    integration = integration.toLowerCase().replace(/\s/g, '');

    if (!(await adminAndGuildInDB(guild, req.cookies.auth))){
      throw new Error(`User ${res.locals.username} is not admin or ${guild} does not exist`);
    }

    // Object to be passed to the editIntegration method
    const editObject = {
      discord_channel: channel
    }

    // Wait for the database to do its thing
    await editIntegration(guild, integration, editObject);

    res.status(200).json({ message: `Channel changed successfully for ${integration} on ${guild}` });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Error when changing channel' });
  }
});

// Called when changing the enabled status of an integration
// validate the integration and update the database
app.patch('/enable-integration', guildValidation, integrationValidation, async (req, res) => {
  try {
    // Check for validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      // If there are validation errors, throw an error
      throw new Error(validationErrors.array().map(error => error.msg).join(', '));
    }

    // Get integration, guild, enabled
    let { guild, integration, enabled } = req.body;
    integration = integration.toLowerCase().replace(/\s/g, '');
  
    // Check if the guild is actually in the database
    if (!(await guildIsInDB(guild))) {
      throw new Error("Trying to enable the integration of a server  not in the database");
    }

    // Make sure that the user is actually admin on the guild
    if (!(await isUserAdmin(guild, req.cookies.auth))){
      throw new Error(`User ${res.locals.username} is not admin on ${guild}`);
    }

    // Object to be passed to the editIntegration method
    const editObject = {
      enabled: enabled
    }

    // Wait for the database to do its thing
    await editIntegration(guild, integration, editObject);

    res.status(200).json({ message: `Enabled succesfully ${integration} on ${guild}` });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Error when enabling integration' });
  }
});

// Get the enabled guilds for the server dropdown
app.get('/get-enabled-guilds', loginRequired, async (req, res) => {
  try {
    // Try to get the admin guilds
    const adminGuilds = await getGuildsRetry(req.cookies.auth);
    const enabledGuilds = await getGuildsEnabledDisabled(adminGuilds, true);

    // Respond with the guilds on which the bot is enabled and the user is admin
    res.status(200).json({enabledGuilds});
  } catch(error) {
    console.error("get-enabled-guilds:", error.message);
    res.status(500).json({ error: 'Error when getting enabled guilds' });
  }
});

// Change the users selected guild
app.patch('/change-selected-guild', loginRequired, guildValidation, integrationValidation, async (req, res) => {
  try {
    // Check for validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      // If there are validation errors, throw an error
      throw new Error(validationErrors.array().map(error => error.msg).join(', '));
    }

    let { guild, integration } = req.body;
    integration = integration.toLowerCase().replace(/\s/g, '');

    if (!(await guildIsInDB(guild))) {
      throw new Error("Trying to change the selected guild to a server not in the database");
    }

      let url = `${config.origin}/integration?integration=${integration}&guild=${guild}`;
      
      // Send the response as JSON
      res.json({ reload: true, url: url});
  } catch (error) {
      console.error("change-selected-guild:", error.message);
      res.status(500).json({ error: "No need to reload" });
  }
});

// Called when the user presses the "settings" button
// Get the tokens for the specific integration
app.get('/get-tokens', loginRequired, guildValidation, integrationValidation, async (req, res) => {
  try {
    // Check for validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      // If there are validation errors, throw an error
      throw new Error(validationErrors.array().map(error => error.msg).join(', '));
    }

    let { guild, integration } = req.query;
    integration = integration.toLowerCase().replace(/\s/g, '');

    if (!(await adminAndGuildInDB(guild, req.cookies.auth))){
      throw new Error(`User ${res.locals.username} is not admin or ${guild} does not exist`);
    }

    // Get the integrationId of the specific integration from the guild
    const integrationId = await getIntegrationId(guild, integration);

    if (integrationId === undefined || integrationId === null) {
      throw new Error("Could not get integration ID");
    }

    // Get the tokens associated with that integrationId
    let tokens = await getTokens(integrationId);
    tokens = tokens.map(token => token.name);

    // Return the tokens as JSON
    res.json({tokens});
  } catch(error) {
    console.error("get-tokens:", error.message);
    res.status(500);
  }
});

// Called when you press apply in the settings box
// Update the tokens for the specific integration
app.patch('/update-tokens', loginRequired, guildValidation, integrationValidation, tokensValidation, async (req, res) => {
  let { guild, integration, tokens } = req.body;
  integration = integration.toLowerCase().replace(/\s/g, '');
  try {
    // Check for validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      // If there are validation errors, throw an error
      throw new Error(validationErrors.array().map(error => error.msg).join(', '));
    }

    if (!(await adminAndGuildInDB(guild, req.cookies.auth))){
      throw new Error(`User ${res.locals.username} is not admin or ${guild} does not exist`);
    }

    // Get the integrationId of the specific integration from the guild
    const integrationId = await getIntegrationId(guild, integration);
    console.log("Integration ID:", integrationId);

    if (integrationId === undefined || integrationId === null) {
      throw new Error("Could not get integration ID");
    }

    let webhookMessage = "";

    // switch case to enable different webhooks
    switch (integration) {
      case 'trello':
        if (tokens.length !== 3) {
          throw new Error("Expected 3 tokens for Trello");
        }
        await removeAllTrelloWebhooks(guild); // Remove existing webhooks

        const orgId = tokens.find(token => token.name === 'Organization ID').key;
        const apiKey = tokens.find(token => token.name === 'API Key').key;
        const apiToken = tokens.find(token => token.name === 'API Token').key;

        const result = await createTrelloWebhooks(guild, orgId, apiKey, apiToken, integrationId); // Create new webhooks
        console.log("Created webhooks:", result);
        if (result.createdWebhooks.length === 0) {
          throw new Error("Could not create webhooks");
        }

        if (result.successBoards.length > 0) {
          const successBoardsString = result.successBoards.join(', ');
          webhookMessage += `Successfully created webhooks for ${successBoardsString}`;
        }
        
        if (result.failedBoards.length > 0) {
          const failedBoardsString = result.failedBoards.join(', ');
          if (webhookMessage !== "") {
              webhookMessage += `, couldn't create webhooks for ${failedBoardsString}`;
          } else {
              webhookMessage += `Couldn't create webhooks for ${failedBoardsString}`;
          }
        }
        break;
      case 'github':
        if (tokens.length !== 2) {
          throw new Error("Expected 2 token for GitHub");
        }

        await removeGithubWebhook(guild);

        try {
          const orgId = tokens.find(token => token.name === 'Organization').key;
          const apiKey = tokens.find(token => token.name === 'Token').key;

          await createGithubWebhook(guild, orgId, apiKey);
        }
        catch (error) {
          console.error(error.message);
          if (error.message === "Bad credentials") {
            throw new Error("Bad credentials. Please check your token.");
          }
        }

        break;
      case 'googlecalendar':
        if (tokens.length !== 4) {
          throw new Error("Expected 4 tokens for Google Calendar");
        }
        await removeGoogleWebhook(guild);
        
        try {
          const client_secret = tokens.find(token => token.name === 'Client Secret').key;
          const token = tokens.find(token => token.name === 'Token').key;
          const Calendar_id = tokens.find(token => token.name === 'Calendar ID').key;
          const client_id= tokens.find(token => token.name === 'Client ID').key;
          await createGoogleWebhook(guild, client_id, client_secret, token, Calendar_id);
        }
        catch (error) {
          console.error(error.message);
          if (error.message === "Bad credentials") {
            throw new Error("Bad credentials. Please check your token.");
          }
        }
          
        break;
      default:
        throw new Error("Got unknown integration");
    }

    // Update all tokens
    await Promise.all(tokens.map(async token => {
        const editObject = {
          key: token.key
        };
        await editToken('tokens', integrationId, token.name, editObject);
    }));

    // Respond with OK
    res.status(200).json({ message: `Tokens updated successfully.${webhookMessage}` });
  } catch (error) {
    console.error("update-tokens:", error.message);
    await clearTokens(guild, integration);
    res.status(500).json({ error: `Could not set tokens: ${error.message}. Double check that your information is correct. Previously stored tokens have been cleared.` });
  }
});

// Called when the user wants to get the services that can be added
// get the services that are not already enabled
app.get('/get-services', loginRequired, guildValidation, integrationValidation, serviceTypeValidation, async (req, res) => {
  try {
    // Check for validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      // If there are validation errors, throw an error
      throw new Error(validationErrors.array().map(error => error.msg).join(', '));
    }

    // Get the query parameters
    let { integration, guild, serviceType } = req.query;
    integration = integration.toLowerCase().replace(/\s/g, '');

    console.log("/get-services called");

    if (!(await adminAndGuildInDB(guild, req.cookies.auth))){
      throw new Error(`User ${res.locals.username} is not admin or ${guild} does not exist`);
    }

    const integrationId = await getIntegrationId(guild, integration);

    
    let enabledServices = [];
    let availableServices = [];
    if (serviceType == 'commands') {
      availableServices = await get_commands(integration);
      
      // Map name and description to each element
      availableServices = availableServices.map(service => {
        const { name, description } = service.data;
        return {
          name: name,
          description: description
        }
      });
      // Get the enabled commands
      enabledServices = (await getIntegrationSettings(guild, integration)).commands;
    } else if (serviceType == 'notifications') {
      // Get the enabled notifications
      enabledServices = (await getIntegrationSettings(guild, integration)).notifications;
      // add the services to the object availableServices
      switch (integration) {
        case "trello":
          trelloNotifications.forEach(notification => {
            // Create an object with name, description, and codename properties
            const service = {
                name: notification.name,
                description: notification.description,
                codename: notification.codename
            };
            // Add the service object to availableServices array
            availableServices.push(service);
        });
          break;
        case "github":
          githubNotifications.forEach(notification => {
            // Create an object with only a name property
            const service = {
              name: notification.name,
              description: notification.description,
              codename: notification.codename
          };
          // Add the service object to availableServices array
          availableServices.push(service);
        });
          break;
        case "googlecalendar":
          googleNotifications.forEach(notification => {
            // Create an object with only a name property
            const service = {
              name: notification.name,
              description: notification.description,
              codename: notification.codename
          };
          // Add the service object to availableServices array
          availableServices.push(service);
        });
          break;
        default:
          break;
      }
    } else {
      throw new Error(`Got unexpected type ${serviceType}`);
    }

    enabledServices = enabledServices.map(service => service.name);
    // Filter out the ones that are already enabled
    const services = availableServices.filter(service => !enabledServices.includes(service.name));

    res.json({ amount: services.length, services});
  } catch (error) {
    console.error("/get-services", error.message);
  }
});
// Called when the user wants to add a service
// validate the service and add it to the database
app.post('/add-services', loginRequired, guildValidation, integrationValidation, serviceTypeValidation, servicesValidation, async (req, res) => {
  try {
    console.log("/add-services called");
    // Check for validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      // If there are validation errors, throw an error
      throw new Error(validationErrors.array().map(error => error.msg).join(', '));
    }

    let { guild, integration, serviceType, services } = req.body;
    integration = integration.toLowerCase().replace(/\s/g, '');

    if (!(await adminAndGuildInDB(guild, req.cookies.auth))) {
      throw new Error(`User ${res.locals.username} is not admin or ${guild} does not exist`);
    }

    // Get the integrationId of the specific integration from the guild
    const integrationId = await getIntegrationId(guild, integration);

    if (integrationId === undefined || integrationId === null) {
      throw new Error("Could not get integration ID");
    }

    let addedServices = [];
    let availableServices = [];
    if (serviceType === 'commands') {
      availableServices = await get_commands(integration);
      availableServices = availableServices.map(service => {
        const { name, description } = service.data;
        return {
          name: name,
          description: description
        }
      });
      addedServices = await addServices(availableServices, integrationId, integration, serviceType, services);
      // Enable the commands on the Discord Bot
      await enableCommands(guild, addedServices.map(service => service.name));
    } 
    else if (serviceType === 'notifications') {
      // Add the services to the availableServices
      let notifications = integration === "github" ? githubNotifications : googleNotifications;
      if (integration === "trello") {
        notifications = trelloNotifications;
      }
      Object.keys(notifications).forEach(className => {
          const notification = notifications[className];
          const service = {
              name: notification.name,
              description: notification.description,
              codename: notification.codename,
          };
          availableServices.push(service);
      });
      // services = availableServices.filter(service => services.includes(service.name.replace(/\s/g, '')));
      // services = services.map(service => service.name);
      
      addedServices = await addServices(availableServices, integrationId, integration, serviceType, services);
      addedServices.forEach(async (service) => {
          await addNewNotification(integrationId, service.name);
      });

    } else {
      throw new Error(`Got unknown service type, ${serviceType}`);
    }

    /**
     *  Add services to the database
     * @param {array} availableServices array of available services
     * @param {number} integrationId intergration id
     * @param {string} integration  integration of choise
     * @param {string} serviceType  type of service
     * @param {string} services 
     * @returns array addedServices
     */
    async function addServices(availableServices, integrationId, integration, serviceType, services) {
      const addedServices = [];
      let enabledServices = await getIntegrationSettings(guild, integration);
      if (serviceType === 'commands') {
        enabledServices = enabledServices.commands;
      } else if (serviceType === 'notifications') {
        enabledServices = enabledServices.notifications;
      }
      
      // Remove spaces from enabledServices array
      enabledServices = enabledServices.map(service => service.name.replace(/\s/g, ''));
      
      for (const service of services) {
        // Remove spaces from current service before comparison
        const trimmedService = service.replace(/\s/g, '');
        
        // Check if the service is not already enabled
        if (!enabledServices.includes(trimmedService)) {
          // Ensure that the service is available for the integration
          if (!availableServices.some(availableService => availableService.name === service)) {
            throw new Error(`Service ${service} of type ${serviceType} is not available for ${integration}`);
          }
          
          // Create an object to be added to the database
          const serviceObject = {
            integration_id: integrationId,
            service_name: service,
            service_type: serviceType,
            description: availableServices.find(availableService => availableService.name === service).description
          };
          
          // Call the addService method
          await addService(serviceObject);
          
          // Add the service to the addedServices array
          addedServices.push({ name: service, description: serviceObject.description});
        }
      }
      
      return addedServices;
    }

    // Send back the added services
    res.json({ addedServices });
  } catch (error) {
    console.error("/add-services", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Called when the user wants to remove a service
app.delete('/remove-service', loginRequired, guildValidation, integrationValidation, serviceTypeValidation, serviceValidation, async (req, res) => {
  try {
    console.log('/remove-service called');
    // Check for validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      // If there are validation errors, throw an error
      throw new Error(validationErrors.array().map(error => error.msg).join(', '));
    }

    let { guild, integration, serviceType, service } = req.body;
    integration = integration.toLowerCase().replace(/\s/g, '');
    console.log("deleteService, Service:", service, "ServiceType:", serviceType, "Integration:", integration, "Guild:", guild);

    if (!(await adminAndGuildInDB(guild, req.cookies.auth))){
      throw new Error(`User ${res.locals.username} is not admin or ${guild} does not exist`);
    }

    // Get the integrationId of the specific integration from the guild
    const integrationId = await getIntegrationId(guild, integration);

    if (integrationId === undefined || integrationId === null) {
      throw new Error("Could not get integration ID");
    }

    if (serviceType === 'commands') {
      // Disable the command on the Discord Bot
      await disableCommands(guild, service);
    } else if (serviceType === 'notifications') {
      removeNotification(integrationId, service);
    } else {    
      throw new Error(`Got unknown service type, ${serviceType}`);
    }

    // Remove the service from the database
    await removeService(integrationId, serviceType, service);

    // Tell the client that they can remove the service from the frontend
    res.status(200).json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error("/remove-service", error.message);
    res.status(500).json({ error: "Error when removing service" });
  }
});

// Send a message to the Discord bot
app.post('/github-webhook', async (req, res) => {

  const secret = config.secret;

  const event = req.body;
  const eventType = req.headers['x-github-event'];
  const guildID = req.query.guildId;

  const signature = req.headers['x-hub-signature'];

  const hmac = crypto.createHmac('sha1', secret);
  const digest = 'sha1=' + hmac.update(JSON.stringify(event)).digest('hex');

  // Compare the digest with the signature
  if (signature !== digest) {
    return res.status(403).send('Invalid signature');
  }

  await sendGithubEventToDiscord(eventType, event, guildID);
  res.sendStatus(200);
});

// Send a message to the Discord bot
app.post('/google-webhook', async (req, res) => {
  try {
    const resourceId = req.headers['x-goog-resource-id'];
    const resourceUrl = req.headers['x-goog-resource-uri'];
    const channelId = req.headers['x-goog-channel-id'];
    const guildId = req.query.guildId;

    if (resourceId === undefined || resourceUrl === undefined || channelId === undefined) {
      res.status(400).json({ error: "Missing headers" });
      return;
    }

    // Get the webhooks from the database

    const integrationId = await getIntegrationId(guildId, "googlecalendar");

    const webhooks = await getGoogleWebhook(integrationId);

    let webhook = webhooks[0];

    // Check that the channelId and resourceId match the values in the database
    if (webhook.channel_id !== channelId || webhook.resource_id !== resourceId) {
      res.status(403).json({ error: "Invalid headers" });
      return;
    }

    console.log("Google webhook verified");
    await getGoogleEvents(guildId);
    res.sendStatus(200);
  } catch (error){
    console.error("/google-webhook", error);
  }
});

// Send a message to the Discord bot
app.all('/trello-webhook', async (req, res) => {
    if (req.method === 'HEAD') {
      return res.sendStatus(200);
    }

    console.log("Trello webhook received");

    const secret = config.secret;
    const event = req.body;
    const guildId = req.query.guildId;
    const trelloSecret = req.query.secretId;

    if (secret !== trelloSecret) {
      console.log(req.query);
      return res.sendStatus(410).send('Invalid signature'); // Tell Trello to delete the webhook
    }

  // Assuming sendTrelloEventToDiscord is a function that handles the Trello event
  await sendTrelloEventToDiscord(event, guildId);

  res.sendStatus(200);
});

// Start the server on port 3000
app.listen(port, () => {
  console.log(`Server running at ${config.origin.replace(/:\d+$/, ":" + port)}`);
});
