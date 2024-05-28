import mysql from 'mysql2/promise';
import dotenv from 'dotenv'

// Loads token from .env file
dotenv.config();
const config = {
    host: process.env.MYSQL_HOST,
    user: 'root',
    password: process.env.MYSQL_ROOT_PASSWORD,
    database: 'p2_database',
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0
};
  
let pool;
  
// Connect to MySQL server
async function connectToMySQL() {
    let connection;
    try {
        pool = mysql.createPool(config);
          
        // Get a connection from the pool to test the connection
        connection = await pool.getConnection();
        console.log(`Successfully connected to mysql server database: ${config.database}`);
    } catch (err) {
        console.error('Error connecting to mysql server:', err.message);
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * Add a new guild to the database
 * @param {number} guildId The ID of the guild
 * @param {number} discordChannel The default Discord channel for all integrations, default to null
 */
async function addNewGuild(guildId, discordChannel = null) {
    try {
        if (!guildId) {
            throw new Error('Could not get serverId');
        }

        if (await guildIsInDB(guildId)) {
            throw new Error('Server is already added');
        }
      
        // Create rows in the integration table and get the integration ID's of the newly integrate
        await addIntegration(guildId, 'trello', discordChannel);
        await addIntegration(guildId, 'github', discordChannel);
        await addIntegration(guildId, 'googlecalendar', discordChannel);
      
        // Get integration ID's of the newly generated rows in the integrations table
        const trelloId = await getIntegrationId(guildId, "trello");
        const googlecalendarId = await getIntegrationId(guildId, "googlecalendar");
        const githubId = await getIntegrationId(guildId, "github");

        // Create rows in the tokens table for Trello tokens
        await createToken(trelloId, "Organization ID");
        await createToken(trelloId, "API Key");
        await createToken(trelloId, "API Token");
        
        // Create rows in the tokens table for Google Calendar tokens
        await createToken(googlecalendarId, "Calendar ID");
        await createToken(googlecalendarId, "Client ID");
        await createToken(googlecalendarId, "Client Secret");
        await createToken(googlecalendarId, "Token");
        
        // Create a row in the tokens table for the GitHub token
        await createToken(githubId, "Token");
        await createToken(githubId, "Organization");

        return [trelloId, googlecalendarId, githubId];
    } catch (error) {
        // Handle errors
        console.error('Error when adding to server table:', error.message);
        throw error;
    }
}

/**
 * Inserts an object into a specific table in the database
 * @param {object} object The object to insert into the table. The fields in the object must correspond to the columns in the table
 * @param {string} tableName The name of the table
 * @returns {Promise<object>} A promise which resolves to the object that was inserted
 */
async function insertIntoTable(object, tableName) {
    try {
        if (!tableName) {
            reject(new Error('Table name is required'));
            return;
        }
        if (!object) {
            reject(new Error('No valid object provided'));
            return;
        }

        // Query string using ?? and ? to avoid SQL injection
        const query = 'INSERT INTO ?? SET ?';
    
        // Execute the query
        const [results] = await pool.query(query, [tableName, object]);
        return results;
    } catch (error) {
        console.error(error.message);
        throw error;
    }
}

/**
 * Adds a row to the integrations table in the database
 * @param {number} guildId The ID of the guild which the integration belongs to
 * @param {string} integrationName The name of the integration
 * @param {number} discordChannel The standard discord channel
 * @returns {Promise<{integration_name: string, enabled: boolean, server_id: number, discord_channel: number}>} Returns a promise which resolves to an object containing the newly added integration row
 */
async function addIntegration(guildId, integrationName, discordChannel = null){
    try {
        if (!guildId) {
            throw new Error('Could not get server ID');
        }

        // Create an object for the new integration
        const newIntegration = {
            integration_name: integrationName,
            server_id: guildId,
            discord_channel: discordChannel
        }

        // Insert it into the table
        const results = await insertIntoTable(newIntegration, 'integrations');
        return results;
    } catch (error) {
        console.error(error.message);
        throw error;
    }
}

/**
 * Create a new token in the database
 * @param {number} integrationId The ID of the integration the token is associated with
 * @param {string} tokenName The name of the token
 */
async function createToken(integrationId, tokenName) {
    try {
        const tokenObject = {
            integration_id: integrationId,
            name: tokenName,
            key: ""
        }

        const results = await insertIntoTable(tokenObject, 'tokens');
        return results;
    } catch (error) {
        // Handle errors
        console.error("createToken error:", error.message);
    }
}

/**
 * Remove a guild from the database
 * @param {*} guildId ID of the guild that needs to be removed
 * @returns {Promise<string>} Resolves to a promise that describes the outcome of the operation
 */
async function removeGuild(guildId) {
    try {
        if (!guildId) {
            throw new Error('Could not get serverId');
        }

        if (!(await guildIsInDB(guildId))) {
            throw new Error("Server was not found in the database");
        }

        // Query string, use ? to avoid SQL injection
        const deleteIntegrations = 'DELETE FROM integrations WHERE server_id = ?';

        const [results] = await pool.execute(deleteIntegrations, [guildId]);
        return results;
    } catch (error) {
        // Handle errors
        console.error('Error removing server and integrations:', error.message);
        throw error;
    }
}

/**
 * Edit the settings of an integration
 * @param {number} guildId The ID of the guild of the integration
 * @param {string} integrationName The name of the integration
 * @param {object} editObject The object containing the columns that need to be updated. All fields must correspond to a column in the table
 * @returns {Promise<object>} A promise which resolves to the object that was used to update.
 */
async function editIntegration(guildId, integrationName, editObject) {
    try {
        if (!integrationName) {
            reject(new Error('Integration name is required'));
            return;
        } 
        if (!guildId) {
            reject(new Error('Server ID is required'));
            return;
        } 
        if (!editObject || Object.keys(editObject).length === 0) {
            reject(new Error('No valid edit object provided'));
            return;
        }

        // Create query string, using ? to avoid SQL injection
        const query = `UPDATE integrations SET ? WHERE server_id = ? AND integration_name = ?`;

        // Query the database using the query string and the parameters
        const [results] = await pool.query(query, [editObject, guildId, integrationName]);
        return results;
    } catch (error) {
        // Handle errors
        console.error("editIntegration:", error.message);
        return error;
    }
}

/**
 * Edit one token associated with a specific integration
 * @param {string} tableName The name of the table (should always be 'tokens')
 * @param {number} integrationId The ID of the integration the token is associated with
 * @param {string} tokenName The name of the token
 * @param {object} editObject An object containing just the "key" field of the token
 * @returns {Promise<object>} A promise which resolves to the token that was updated
 */
async function editToken(tableName, integrationId, tokenName, editObject) {
    try {
        if (!tableName) {
            throw new Error('Table name is required');
        }

        if (!integrationId) {
            throw new Error('Integration ID is required');
        }

        if (!editObject || Object.keys(editObject).length === 0) {
            throw new Error('No valid edit object provided');
        }

        // Create query string, using ?? and ? to avoid SQL injection
        const query = 'UPDATE ?? SET ? WHERE integration_id = ? AND `name` = ?'

        // Query the database using the query string and the parameters.
        const [results] = await pool.query(query, [tableName, editObject, integrationId, tokenName]);
        return results;
    } catch (error) {
        // Handle errors
        console.error("editToken:", error.message);
        throw error;
    }
}

async function clearTokens(guildId, integrationName) {
    try {
        const integrationId = await getIntegrationId(guildId, integrationName);
        const tokens = await getTokens(integrationId);
        await Promise.all(tokens.map(async token => {
            await editToken('tokens', integrationId, token.name, { key: "" });
        }));
    } catch (error) {
        console.error("clearTokens:", error.message);
        return error;
    }
}

/**
 * Checks whether a given guild is in the database
 * @param {number} guildId The ID of the guild
 * @returns {Promise<boolean>} A promise that resolves to true if the guild is in the database, false otherwise
 */
async function guildIsInDB(guildId) {
    try {
        if (!guildId) {
            throw new Error("serverIsInDB: serverId was undefined");
        }

        // Create query string. We want to select any guild that exists, but as there should never be more than one guild
        // with the same guild ID, limit the selection to 1
        const query = 'SELECT EXISTS(SELECT * FROM integrations WHERE server_id = ? LIMIT 1)';

        // Query the database with the query string and the guildId as parameter
        const [results] = await pool.execute(query, [guildId]);
        return results[0][Object.keys(results[0])[0]] === 1;
    } catch (error) {
        // Handle errors
        console.error("guildIsInDB:", error.message);
        throw error;
    }
}

/**
 * Get settings for a specific integration of a specific guild
 * @param {*} guildId ID of the guild for the integration
 * @param {*} integrationName Name of the integration
 * @returns {Promise<{enabled: boolean, discord_channel: string, notifications: [{services_id: number, integration_id: number, service_type: string, message: string}], commands: [{services_id: number, integration_id: number, service_type: string, message: string}]}>} A promise that resolves to an object containing settings, notifications and commands for the given integration
 */
async function getIntegrationSettings(guildId, integrationName) {
    let connection = null;
    let settings = null;
    try {
        if (!guildId) {
            throw new Error("getIntegrationSettings: serverId was undefined");
        }
        if (!integrationName) {
            throw new Error("getIntegrationSettings: integrationName was undefined");
        }

        connection = await pool.getConnection();
        
        // Create query string for querying the integrations table
        const queryIntegration = 'SELECT * FROM integrations WHERE server_id = ? AND integration_name = ? LIMIT 1';

        const [resultsIntegration] = await connection.execute(queryIntegration, [guildId, integrationName]);

        // If we got an integration create the settings object
        if (resultsIntegration.length > 0) {
                settings = {
                    discord_channel: resultsIntegration[0].discord_channel,
                    notifications: [],
                    commands: []
                };
    
                // Create query string for querying the services table
                const queryServices = 'SELECT * FROM services WHERE integration_id = ?'
    
                const [resultsServices] = await connection.execute(queryServices, [resultsIntegration[0].integration_id]);
    
                // If we got some services, filter them by type and then add them to the settings object
                if (resultsServices.length > 0) {
                    let notifications = resultsServices.filter((res) => res.service_type === 'notifications').map(notification => {
                        return {
                            name: notification.service_name, description: notification.description
                        }
                    });
                    let commands = resultsServices.filter((res) => res.service_type === 'commands').map(command => { 
                        return {
                            name: command.service_name, description: command.description 
                        }});
    
                    settings.notifications = notifications;
                    settings.commands = commands;
                } 
            }
        return settings;
    } catch (error) {
        // Handle errors
        console.error("getIntegrationSettings:", error.message);
        throw error;
    } finally {
        // Release the connection no matter if the query failed or not
        if (connection) {
            connection.release();
        }
    }
}

/**
 * Get the integrationId of a specific integration. Returns multiple integrationsIds if integrationName is not specified
 * @param {number} guildId The guildId of the integration
 * @param {string} integrationName The name of the integration, defaults to an empty string
 * @returns {Promise<[number]>} A promise which resolves to an array of integration ID's
 */
async function getIntegrationId(guildId, integrationName = "") {
    try {
        if (!guildId) {
            throw new Error("serverId was undefined");
        }

        let queryParams = [guildId];
        let query;

        // If we got an integrationName, only look for that
        if (integrationName !== "") {
            query = 'SELECT integration_id FROM integrations WHERE server_id = ? AND integration_name = ? LIMIT 1';
            queryParams.push(integrationName); 
        } else {
            // Otherwise look for all integrations that match the guildId
            query = 'SELECT integration_id FROM integrations WHERE server_id = ? LIMIT 3';
        }

        let [results] = await pool.execute(query, queryParams);
        results = results.map(result => result.integration_id);

        if (results.length === 1) {
            results = results[0];
        } else if (results.length === 0) {
            throw new Error("No integration found");
        }
        return results;
    } catch (error) {
        // Handle errors
        console.error("getIntegrationId:", error.message);
        throw error;
    }
}

/**
 * Retrieves tokens associated with a specific integration
 * @param {number} integrationId The ID of the integration
 * @returns {Promise<[token_id: number, integration_id: number, name: string, key: string]>} A promise which resolves to an array of the retreived tokens
 */
async function getTokens(integrationId) {
    try {
        if (!integrationId) {
            throw new Error("integrationId undefined");
        }

        // Create query string using ? to avoid SQL injection
        const tokenQuery = 'SELECT * FROM tokens WHERE integration_id = ?';
        
        // Query the database using the query string and the integration Id
        const [results] = await pool.execute(tokenQuery, [integrationId]);
        return results;
    } catch (error) {
        // Handle errors
        console.error("getTokens:", error.message);
        throw error;
    }
}

/**
 * Add a new service to the database
 * @param {object} serviceObject The object containing the service information
 */
async function addService(serviceObject) {
    try {
        const results = await insertIntoTable(serviceObject, 'services');
        return results;
    } catch (error) {
        console.error("addService:", error.message);
        throw error;
    }
}

/**
 * Remove a service from the database
 * @param {number} integrationId The ID of the integration
 * @param {string} serviceType The type of the service
 * @param {string} serviceName The name of the service
 * @returns {Promise<object>} A promise which resolves to the object that was removed
 */
async function removeService(integrationId, serviceType, serviceName) {
    try {
        if (!integrationId) {
            throw new Error("integrationId was undefined");
        }
        if (!serviceType) {
            throw new Error("serviceType was undefined");
        }
        if (!serviceName) {
            throw new Error("serviceName was undefined");
        }

        // Create query string using ?? and ? to avoid SQL injection
        const query = 'DELETE FROM services WHERE integration_id = ? AND service_type = ? AND service_name = ?';

        // Query the database using the query string and the parameters
        const [results] = await pool.execute(query, [integrationId, serviceType, serviceName]);
        return results;
    } catch (error) {
        // Handle errors
        console.error("removeService:", error.message);
        throw error;
    }
}

/**
 * Get a specific token
 * @param {number} integrationId 
 * @param {string} tokenName 
 * @returns {Promise<object|null>} A promise that resolves to the token object or null if not found
 */
async function getToken(integrationId, tokenName) {
    try {
        if (!integrationId) {
            throw new Error("integrationId was undefined");
        }

        if (!tokenName) {
            throw new Error("tokenName was undefined");
        }

        // Create query string using ?? and ? to avoid SQL injection
        const query = 'SELECT `key` FROM tokens WHERE integration_id = ? AND `name` = ? LIMIT 1';

        // Query the database using the query string and the parameters
        const [results] = await pool.execute(query, [integrationId, tokenName]);

        return results.map(result => result.key)[0];
    } catch (error) {
        // Handle error
        console.error("getToken:", error.message);
        throw error;
    }
}

/**
 * Get all enabled notifications stored in database for a specific integration
 * @param {number} integrationId The ID of the integration
 * @returns {Promise<[string]>} A promise which resolves to an array of objects containing notifications
 */
async function getAllNotifications(integrationId) {
    try {
        if (!integrationId) {
            throw new Error("integrationId was undefined");
        }

        const query = 'SELECT `name` FROM notifications WHERE integration_id = ?';
        const [results] = await pool.execute(query, [integrationId]);
        return results;
    } catch (error) {
        // Handle errors
        console.error("getAllNotifications:", error.message);
        throw error;
    }
}

/**
 * Add a new notification to the database
 * @param {number} integrationId The ID of the integration
 * @param {string} name The name of the notification
 * @returns {Promise<object>} A promise which resolves to the notification object that was added
 */
async function addNewNotification(integrationId, name) {
    let connection = null;
    try {
        if (!integrationId) {
            throw new Error("integrationId was undefined");
        }
        if (!name) {
            throw new Error("name was undefined");
        }

        connection = await pool.getConnection();

        const selectQuery = 'SELECT * FROM notifications WHERE integration_id = ? AND `name` = ?';
        let [results] = await connection.execute(selectQuery, [integrationId, name]);

        if (results.length > 0) {
            throw new Error('Notification already exists');
        } else {
            const insertQuery = 'INSERT INTO notifications (integration_id, `name`) VALUES (?, ?)';
            [results] = await connection.execute(insertQuery, [integrationId, name]);
        }

        return results;
     }  catch (error) {
        // Handle errors
        console.error("addNewNotification:", error.message);
        throw error;
    } finally {
        // Release the connection no matter if the query failed or not
        if (connection) {
            connection.release();
        }
    }
}

/**
 * Edit the synctoken for a specific integration
 * @param {number} integrationId The ID of the integration
 * @param {string} value The new synctoken value
 * @returns {Promise<object>} A promise which resolves to the object that was updated
 */
async function editSyncTokenGoogleCalendar(integrationId, value) {
    try {
        if (!integrationId) {
            throw new Error("integrationId was undefined");
        }
        if (!value && value !== null) {
            throw new Error("value was undefined");
        }
    
        const updateQuery = 'UPDATE google_webhooks SET synctoken = ? WHERE integration_id = ?';
        const [results] = await pool.execute(updateQuery, [value, integrationId]);

        return results;
    } catch (error) {
        // Handle errors
        console.error("editSyncTokenGoogleCalendar:", error.message);
        throw error;
    }
}

/**
 * Get webhook information for a specific integration
 * @param {number} integrationId The ID of the integration
 * @returns {Promise<object>} A promise which resolves to the webhook object
 */
async function getGoogleWebhook(integrationId) {
    try {
        if (!integrationId) {
            throw new Error("integrationId was undefined");
        }

        const query = 'SELECT * FROM google_webhooks WHERE integration_id = ?';
        const [results] = await pool.execute(query, [integrationId]);
        return results;
    }  catch (error) {
        // Handle errors
        console.error("getGoogleWebhook:", error.message);
        throw error;
    }
}

/**
 * Save the webhook information for a specific guild and integration
 * @param {number} guildId The ID of the guild
 * @param {number} channelId The ID of the channel
 * @param {string} resourceId The ID of the resource
 * @returns {Promise<object>} A promise which resolves to the object that was saved
 */
async function saveGoogleCalendarWebhook(guildId, channelId, resourceId) {
    let connection = null;
    try {
        if (!guildId) {
            throw new Error("guildId was undefined");
        }
        if (!channelId) {
            throw new Error("channelId was undefined");
        }
        if (!resourceId) {
            throw new Error("resourceId was undefined");
        }
    
        const integrationId = await getIntegrationId(guildId, "googlecalendar");

        connection = await pool.getConnection();

        const selectQuery = 'SELECT * FROM google_webhooks WHERE integration_id = ?';
        let [results] = await connection.execute(selectQuery, [integrationId]);

        if (results.length > 0) {
            console.log("deleting old webhook");
            const deleteQuery = 'DELETE FROM google_webhooks WHERE integration_id = ?';
            await connection.execute(deleteQuery, [integrationId]);
        }

        const insertQuery = 'INSERT INTO google_webhooks (integration_id, channel_id, resource_id) VALUES (?, ?, ?)';
        [results] = await connection.execute(insertQuery, [integrationId, channelId, resourceId]);

        return results;
    } catch (error) {
        // Handle errors
        console.error("saveGoogleCalendarWebhook:", error.message);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}
/**
 * Remove a specific notification from the database
 * @param {number} integrationId The ID of the integration
 * @param {string} name The name of the notification
 * @returns {Promise<object>} A promise which resolves to the object that was removed
 */
async function removeNotification(integrationId, name) {
    try {
        if (!integrationId) {
            throw new Error("integrationId was undefined");
        }

        if (!name) {
            throw new Error("name was undefined");
        }

        const query = 'DELETE FROM notifications WHERE integration_id = ? AND `name` = ?';
        const [results] = await pool.execute(query, [integrationId, name]);
        return results;
    } catch (error) {
        // Handle errors
        console.error("removeNotification:", error.message);
        throw error;
    }
}

export{
    connectToMySQL,
    addNewGuild,
    guildIsInDB,
    removeGuild,
    getIntegrationSettings,
    editIntegration,
    editToken,
    addIntegration,
    getIntegrationId,
    getTokens,
    getToken,
    removeService,
    addService,
    removeNotification,
    insertIntoTable,
    editSyncTokenGoogleCalendar,
    addNewNotification,
    clearTokens,
    saveGoogleCalendarWebhook,
    getAllNotifications,
    getGoogleWebhook,
    createToken
}
