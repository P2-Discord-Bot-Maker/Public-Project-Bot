import { connectToMySQL, insertIntoTable, addNewGuild, getIntegrationId, getToken, createToken, getTokens, editToken, getIntegrationSettings, guildIsInDB, addIntegration, removeGuild, editIntegration, addService, removeService, getAllNotifications, addNewNotification, removeNotification } from '../src/database/database.js';
import assert from 'assert';

/*
* This file contains tests for the database functions.
* The setup for the database initially looks like this:
* Integrations Table:
+----------------+---------------------+------------------+---------------------+
| integration_id | server_id           | integration_name | discord_channel     |
+----------------+---------------------+------------------+---------------------+
|              1 | 1197222649101824030 | trello           | 1197222649747742813 |
|              2 | 1197222649101824030 | github           | 1197222649747742813 |
|              3 | 1197222649101824030 | googlecalendar   | 1197222649747742813 |
+----------------+---------------------+------------------+---------------------+
* Tokens Table:
+----------+----------------+-----------------+------+
| token_id | integration_id | name            | key  |
+----------+----------------+-----------------+------+
|        1 |              1 | Organization ID |      |
|        2 |              1 | API Key         |      |
|        3 |              1 | API Token       |      |
|        4 |              3 | Calendar ID     |      |
|        5 |              3 | Client ID       |      |
|        6 |              3 | Client Secret   |      |
|        7 |              3 | Token           |      |
|        8 |              2 | Token           |      |
|        9 |              2 | Organization    |      |
+----------+----------------+-----------------+------+
* Services table:
+-------------+----------------+--------------+---------------+--------------------------------------------+
| services_id | integration_id | service_name | service_type  | description                                |
+-------------+----------------+--------------+---------------+--------------------------------------------+
|           1 |              1 | Card Created | notifications | Triggered when a Trello card is created    |
|           2 |              1 | Card Updated | notifications | Triggered when a Trello card is updated    |
|           3 |              1 | Card Move    | notifications | Triggered when a Trello card is moved      |
|           4 |              1 | ttask        | commands      | Assign a member to a card on Trello Board  |
|           5 |              1 | tlabel       | commands      | Add a label to a card on Trello            |
|           6 |              1 | tlistcards   | commands      | List trello cards                          |
|           7 |              2 | gcreate      | commands      | Create on Github                           |
|           8 |              2 | gdelete      | commands      | Delete on Github                           |
|           9 |              2 | gtask        | commands      | Assign a member to a pullrequest on Github |
+-------------+----------------+--------------+---------------+--------------------------------------------+
* Notifications table:
+-----------------+----------------+--------------+
| notification_id | integration_id | name         |
+-----------------+----------------+--------------+
|               1 |              1 | Card Updated |
|               2 |              1 | Card Created |
|               3 |              1 | Card Move    |
+-----------------+----------------+--------------+
*/

describe('Database Functions', () => {
    before(async () => {
        // Connect to the database before running tests
        await connectToMySQL();
    });

    // Test for the insertIntoTable function
    it('should insert data into the table, only if valid columns and column values are provided', async () => {
        const objectToInsert = {
            server_id: 'TEST SERVER ID',
            integration_name: 'TEST INTEGRATION',
            discord_channel: '1234567890123456789',
        }; // Example object to insert
        const tableName = 'integrations'; // Table to insert the object into

        try {
            const results = await insertIntoTable(objectToInsert, tableName);
            // The table has an auto-incrementing ID, so the ID should be greater than 0
            assert.ok(results.insertId > 0, 'Expected the inserted object to have a valid ID');

            
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }

        // Test inserting an object with an invalid column
        const invalidObject = {
            server_id: '1234567890123456789',
            integration_name: 'TEST INTEGRATION',
            invalidColumn: 'Invalid Column Value'
        }

        // The insertion should fail because the column does not exist in the table
        try {
            await insertIntoTable(invalidObject, tableName);
            // If the test reaches this point, the insertion was successful
            assert.fail('Expected the insertion to fail');
        } catch (error) {
            // If an error occurs, the insertion was successful
            assert.ok(error.message.includes(`Unknown column 'invalidColumn' in 'field list'`), 'Expected an Unknown column error');
        }
    });

    // Test for the getIntegrationId function
    it('should retrieve three integration ID from the integrations table if no integrationName is provided, otherwise just one', async () => {
        const serverId = '1197222649101824030'; // Valid server ID from the setup

        try {
            const results = await getIntegrationId(serverId);
            // The table has an auto-incrementing ID, so the ID should be greater than 0
            assert.ok(results.length === 3, 'Expected the retrieved object to have a valid ID');

            // Check the first integration id
            assert.strictEqual(results.includes(1), true, 'Expected the results to include 1');

            // Check the second integration id
            assert.strictEqual(results.includes(2), true, 'Expected the results to include 2');

            // Check the third integration id
            assert.strictEqual(results.includes(3), true, 'Expected the results to include 3');

            const integrationName = 'trello'; // Example integration name
            const singleResults = await getIntegrationId(serverId, integrationName);
            assert.ok(typeof singleResults === 'number', 'Expected the retrieved object to have a valid ID');
            assert.strictEqual(singleResults, 1, 'Expected the retrieved ID to be 1');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the guildIsInDB function
    it('should retrieve true if the server is in the database, false otherwise', async () => {
        const serverId = '1197222649101824030'; // Valid server ID from the setup
        const invalidServer = 'SOME INVALID ID'; // Invalid server ID
        try {
            const results = await guildIsInDB(serverId);
            assert.strictEqual(results, true, 'Expected the server to be in the database');

            const invalidResults = await guildIsInDB(invalidServer);
            assert.strictEqual(invalidResults, false, 'Expected the server to not be in the database');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the addIntegration function
    it('should add a new integration to the integrations table', async () => {
        const serverId = '1234567890123456789'
        const integrationName = 'TEST INTEGRATION';
        const discordChannel = '1234567890';
        try {
            const results = await addIntegration(serverId, integrationName, discordChannel);
            // The table has an auto-incrementing ID, so the ID should be greater than 0
            assert.ok(results.insertId > 0, 'Expected the inserted object to have a valid ID');

            const integrationId = await getIntegrationId(serverId, integrationName);
            // The integration ID should be a number and equal to the inserted ID
            assert.ok(typeof integrationId === 'number', 'Expected the integration ID to be a number');
            assert.ok(integrationId === results.insertId, 'Expected the integration ID to be the same as the inserted ID');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the getTokens function
    it('should retrieve all tokens for a given integration', async () => {
        const integrationId = 1; // Integration ID from the setup
        try {
            const tokens = await getTokens(integrationId);
            // Expecting 3 tokens since there are 3 tokens for the Trello integration
            assert.ok(tokens.length === 3, 'Expected 3 tokens');
            tokens.forEach((token, index) => {
                assert.strictEqual('token_id' in token, true, `Property token_id is missing in token at index ${index}`);
                assert.strictEqual('integration_id' in token, true, `Property integration_id is missing in token at index ${index}`);
                assert.strictEqual('name' in token, true, `Property name is missing in token at index ${index}`);
                assert.strictEqual('key' in token, true, `Property key is missing in token at index ${index}`);
            }); 
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the getToken function
    it('should retrieve the key from a token with the name tokenName from the tokens table', async () => {
        const integrationId = 1; // Integration ID from the setup
        const tokenName = 'API Key'; // Example token name
        try {
            const token = await getToken(integrationId, tokenName);
            // The token should be a string
            assert.ok(typeof token === 'string', 'Expected the token to be a string');
            assert.strictEqual(token, '', 'Expected the token to be empty');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the editToken function
    it('should update the key of a token', async () => {
        const integrationId = 1; // Integration ID from the setup
        const tokenName = 'API Key'; // Valid token name from the setup
        try {
            const token = await getToken(integrationId, tokenName);
            assert.ok(typeof token === 'string', 'Expected the token to be a string');
            const newKey = 'TEST API KEY VALUE';
            const results = await editToken('tokens', integrationId, tokenName, { key: newKey});
            assert.ok(results.affectedRows === 1, 'Expected one row to be affected');
            const newToken = await getToken(integrationId, tokenName);
            assert.ok(newToken === newKey, 'Expected the token to be updated');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the createToken function
    it('should create a new token for a given integration', async () => {
        const integrationId = await getIntegrationId('1197222649101824030', "googlecalendar");
        const tokenName = 'TEST TOKEN'; // Example token name

        try {
            const results = await createToken(integrationId, tokenName);
            // The table has an auto-incrementing ID, so the ID should be greater than 0
            assert.ok(results.insertId > 0, 'Expected the inserted object to have a valid ID');
            
            const tokenKey = await getToken(integrationId, tokenName);
            // The token should be a string
            assert.ok(typeof tokenKey === 'string', 'Expected the token to be a string');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the getIntegrationSettings function
    it('should retrieve the integration settings for a given integration', async () => {
        const guildId = '1197222649101824030'; // Valid server ID from the setup
        const integrationName = 'trello'; // Example integration name
        try {
            const results = await getIntegrationSettings(guildId, integrationName);

            assert.strictEqual('discord_channel' in results, true, 'Property discord_channel is missing');
            assert.strictEqual('notifications' in results, true, 'Property notifications is missing');
            assert.strictEqual('commands' in results, true, 'Property commands is missing');

            // Since for trello for this server there is 3 commands added, we should be able to retrieve them
            assert.strictEqual(results.commands.length, 3, 'Expected 3 commands');
            const commands = results.commands;

            // Check the properties of the first command match the expected values from the database as shown in the setup
            assert.ok(commands[0].name === 'ttask', 'Expected the service name to be ttask');
            assert.ok(commands[0].description === 'Assign a member to a card on Trello Board', 'Expected the description to be Assign a member to a card on Trello Board');

            // Check the properties of the second command match the expected values from the database as shown in the setup
            assert.ok(commands[1].name === 'tlabel', 'Expected the service name to be tlabel');
            assert.ok(commands[1].description === 'Add a label to a card on Trello', 'Expected the description to be Add a label to a card on Trello');

            // Check the properties of the third command match the expected values from the database as shown in the setup
            assert.ok(commands[2].name === 'tlistcards', 'Expected the service name to be tlistcards');
            assert.ok(commands[2].description === 'List trello cards', 'Expected the description to be List trello cards');

            // Check the notifications, there should be 3 notifications as shown in the setup
            assert.strictEqual(results.notifications.length, 3, 'Expected 3 notifications');
            const notifications = results.notifications;

            // Check the properties of the first notification match the expected values from the database as shown in the setup
            assert.ok(notifications[0].name === 'Card Created', 'Expected the service name to be Card Created');
            assert.ok(notifications[0].description === 'Triggered when a Trello card is created', 'Expected the description to be Triggered when a Trello card is created');

            // Check the properties of the second notification match the expected values from the database as shown in the setup
            assert.ok(notifications[1].name === 'Card Updated', 'Expected the service name to be Card Updated');
            assert.ok(notifications[1].description === 'Triggered when a Trello card is updated', 'Expected the description to be Triggered when a Trello card is updated');

            // Check the properties of the third notification match the expected values from the database as shown in the setup
            assert.ok(notifications[2].name === 'Card Move', 'Expected the service name to be Card Move');
            assert.ok(notifications[2].description === 'Triggered when a Trello card is moved', 'Expected the description to be Triggered when a Trello card is moved');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the addNewGuild function
    it('should create a new server by creating 3 integrations rows and corresponding tokens', async () => {
        const serverId = 'TEST SERVER ID 2';
        const discordChannel = '1234567890';
        try {
            const [trelloId, googlecalendarId, githubId] = await addNewGuild(serverId, discordChannel);
            // The table has an auto-incrementing ID, so the ID should be greater than 0
            assert.ok(trelloId > 0, 'Expected the Trello ID to be valid');
            assert.ok(googlecalendarId > 0, 'Expected the Google Calendar ID to be valid');
            assert.ok(githubId > 0, 'Expected the GitHub ID to be valid');

            const trelloTokens = await getTokens(trelloId);
            assert.ok(trelloTokens.length === 3, 'Expected 3 tokens for Trello');

            const googlecalendarTokens = await getTokens(googlecalendarId);
            assert.ok(googlecalendarTokens.length === 4, 'Expected 4 tokens for Google Calendar');

            const githubTokens = await getTokens(githubId);
            assert.ok(githubTokens.length === 2, 'Expected 2 tokens for GitHub');

            const integrationId = await getIntegrationId(serverId, 'trello');
            assert.ok(integrationId === trelloId, 'Expected the integration ID for Trello to be the same as the inserted ID');

            const integrationId2 = await getIntegrationId(serverId, 'googlecalendar');
            assert.ok(integrationId2 === googlecalendarId, 'Expected the integration ID for Google Calendar to be the same as the inserted ID');

            const integrationId3 = await getIntegrationId(serverId, 'github');
            assert.ok(integrationId3 === githubId, 'Expected the integration ID for GitHub to be the same as the inserted ID');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the addService function
    it('should add a service to the services table', async () => {
        const integrationId = await getIntegrationId('TEST SERVER ID 2', "trello");
        const serviceObject = {
            integration_id: integrationId,
            service_name: 'TEST SERVICE',
            service_type: 'commands',
            description: 'Test Description'
        }; // Example service object

        try {
            const results = await insertIntoTable(serviceObject, 'services');
            // The table has an auto-incrementing ID, so the ID should be greater than 0
            assert.ok(results.insertId > 0, 'Expected the inserted object to have a valid ID');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the removeService function
    it('should remove a service from the services table', async () => {
        const integrationId = await getIntegrationId('TEST SERVER ID 2', "trello");
        const serviceName = 'TEST SERVICE 123'; // Example service name
        try {
            // First insert the service
            const serviceObject = {
                integration_id: integrationId,
                service_name: serviceName,
                service_type: 'commands',
                description: 'Test Description'
            }; // Example service object

            await addService(serviceObject);

            // Then remove the service
            const results = await removeService(integrationId, 'commands', serviceName);
            // The number of affected rows should be 1
            assert.ok(results.affectedRows === 1, 'Expected one row to be affected');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the editIntegration function
    it('should edit an integrations discord channel column', async () => {
        const serverId = 'TEST SERVER ID 2';
        const integrationName = 'trello';
        const discordChannel = 'SOME NEW VALUE'; // Example new value
        try {
            const beforeSettings = await getIntegrationSettings(serverId, integrationName);
            // The discord channel should be 1234567890 from line 158
            assert.strictEqual(beforeSettings.discord_channel, '1234567890', 'Expected the discord channel to be 1234567890');

            // Edit the discord channel
            await editIntegration(serverId, integrationName, { discord_channel: discordChannel });

            const afterSettings = await getIntegrationSettings(serverId, integrationName);
            // The discord channel should be the new value
            assert.strictEqual(afterSettings.discord_channel, discordChannel, 'Expected the discord channel to be the new value');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the removeGuild function
    it('should remove a server by deleting all integrations and corresponding tokens and services', async () => {
        const serverId = 'TEST SERVER ID 2';
        let integrationId;
        try {
            integrationId = await getIntegrationId(serverId, 'trello');
            const tokensBefore = await getTokens(integrationId);
            const servicesBefore = await getIntegrationSettings(serverId, 'trello').then((results) => results.commands);

            // Since we added the service TEST SERVICE in the previous test, we should have 1 service
            assert.strictEqual(servicesBefore.length, 1, 'Expected 1 service');
            assert.strictEqual(servicesBefore[0].name, 'TEST SERVICE', 'Expected the service name to be TEST SERVICE')
            assert.strictEqual(servicesBefore[0].description, 'Test Description', 'Expected the service description to be Test Description')

            assert.ok(integrationId > 0, 'Expected the integration ID to be valid');
            assert.ok(tokensBefore.length > 0, 'Expected the tokens to not be empty');

            // Delete the server
            const result = await removeGuild(serverId);
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }

        try {
            integrationId = await getIntegrationId(serverId, 'trello');
        } catch (error) {
            // Expected error getIntegrationId: No integration found
            assert.ok(error.message.includes('No integration found'), 'Expected an error message');
        }

        try {
            const tokensAfter = await getTokens(integrationId);
            const settings = await getIntegrationSettings(serverId, 'trello');

            assert.strictEqual(tokensAfter.length, 0, 'Expected 0 tokens');
            assert.strictEqual(settings, null, 'Expected settings to be null');
        } catch (error) {
            assert.fail(error.message);
        }
    });

    // Test for the getAllNotifications function
    it('should get all notifications for a given integration', async () => {
        const integrationId = 1; // Integration ID from the setup
        try {
            const results = await getAllNotifications(integrationId);

            // The notifications should be an array with 3 elements as shown in the setup
            assert.strictEqual(results.length, 3, 'Expected 3 notifications');
            assert.strictEqual(results[0].name, 'Card Updated', 'Expected the name to be Card Updated');
            assert.strictEqual(results[1].name, 'Card Created', 'Expected the name to be Card Created');
            assert.strictEqual(results[2].name, 'Card Move', 'Expected the name to be Card Move');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the addNewNotification function
    it('should add a new notification to the notifications table', async () => {
        const integrationId = 1; // Integration ID from the setup
        const notificationName = 'TEST NOTIFICATION'; // Example notification name
        try {
            const results = await addNewNotification(integrationId, notificationName);
            // The table has an auto-incrementing ID, so the ID should be greater than 0
            assert.ok(results.insertId > 0, 'Expected the inserted object to have a valid ID');

            const notifications = await getAllNotifications(integrationId);
            // The notifications should be an array with 4 elements
            assert.strictEqual(notifications.length, 4, 'Expected 4 notifications');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });

    // Test for the removeNotification function
    it('should remove a notification from the notifications table', async () => {
        const integrationId = 1; // Integration ID from the setup
        const notificationName = 'TEST NOTIFICATION'; // Example notification name
        try {
            // First check that the notification exists
            const notificationsBefore = await getAllNotifications(integrationId);
            const notificationExists = notificationsBefore.some(notification => notification.name === notificationName);
            assert.ok(notificationExists, 'Expected the notification to exist');

            // Then remove the notification
            const results = await removeNotification(integrationId, notificationName);
            // The number of affected rows should be 1
            assert.ok(results.affectedRows === 1, 'Expected one row to be affected');

            const notificationsAfter = await getAllNotifications(integrationId);
            // The notifications should be an array with 3 elements
            assert.strictEqual(notificationsAfter.length, 3, 'Expected 3 notifications');

            const notificationExistsAfter = notificationsAfter.some(notification => notification.name === notificationName);
            assert.ok(!notificationExistsAfter, 'Expected the notification to not exist');
        } catch (error) {
            // If an error occurs, fail the test
            assert.fail(error.message);
        }
    });
});
