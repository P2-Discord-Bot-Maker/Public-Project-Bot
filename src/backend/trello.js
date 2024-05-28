import Trello from 'trello';
import TrelloNodeAPI from 'trello-node-api';
import { getToken, getIntegrationId } from '../database/database.js';
import { convertToTrelloColor } from './utils.js';

/**
 * - Call this to get trello data, use options to include the data you need.
 * @param {string} guildId 
 * @param {options} options  - The options to include in the response
 * @returns {Promise<any[]>} - An array of the data requested.
 */
async function getTrelloData(guildId, options = {}) {
    try {
        // Get integrationId
        const integrationId = await getIntegrationId(guildId, 'trello');

        // Get the API key
        const apiKey = await getToken(integrationId, 'API Key');

        // Get the API token
        const apiToken = await getToken(integrationId, 'API Token');

        // Create an empty array to contain the data
        const trelloData = [];

        // Add the data to the array based on the options
        if (options.includeTokens) {
            trelloData.push(apiKey, apiToken);
        }

        // Add Trello organization Id to the array
        if (options.includeOrgId) {
            trelloData.push(await getToken(integrationId, 'Organization ID'));
        }

        // Creates new Trello instance
        if (options.createTrelloInstance) {
            trelloData.push(new Trello(apiKey, apiToken));
        }

        // Creates new Trello node instance
        if (options.createTrelloNodeInstance) {
            const trelloNodeInstance = new TrelloNodeAPI();
            trelloNodeInstance.setApiKey(apiKey);
            trelloNodeInstance.setOauthToken(apiToken);
            trelloData.push(trelloNodeInstance);
        }

        // Return the trelloData
        return trelloData;

    // Error handling
    } catch (error) {
        console.error("Error when getting Trello data", error);
        throw error;
    }
}

/**
 * Get the board id from a boardName (within the workspace)
 * @param {string} boardName - The name of the board
 * @returns A board id, as a string.
 */
async function getBoardId(boardName, guildId) {
    try {
        // Get the organization ID and create a new trello instance
        const [orgId, trello] = await getTrelloData(guildId, { includeOrgId: true, createTrelloInstance: true });

        // Get the board Id matching the boardName
        const boardID = await trello.getOrgBoards(orgId)
            .then(boards => boards.filter(board => board.name === boardName))
            .then(boards => boards.map(board => board.id));
        
        // Return the first id.
        return boardID[0];
            
    // Error handling
    } catch (error) {
        console.log('Error getting board from organization id', error);
        // return the error
        throw error;
    }
}

/**
 * Gets every board name within the workspace
 * @returns The name of each board
 */
async function getEveryBoardName(guildId) {
    try {
        // Get the organization ID and create a new trello instance
        const [orgId, trello] = await getTrelloData(guildId, { includeOrgId: true, createTrelloInstance: true });

        // Get and return every board name from organization id.
        return await trello.getOrgBoards(orgId)
        .then(boards => boards.map(board => board.name));
        
    // Error Handling
    } catch (error) {
        console.log('Error getting every board from organization', error);
        // return the error
        throw error;
    }
}

/**
 * Create a new card on a specific board and list
 * @param listName - The name of the list
 * @param cardName - The name of the card
 * @returns {Promise<unknown>} - The response from the API
 */
async function createCard(boardName, listName, cardName, guildId) {
    try {
        // Get the organization ID and create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

        // Get the board ID from the board name
        const boardId = await getBoardId(boardName, guildId);

        // Get the list ID from the list name
        const listId = await getListIdByName(boardId, listName, guildId);

        // Make an API request to create a new card
        return await trello.addCard(cardName, "", listId);

    // Error handling
    } catch (error) {
        console.error('Error creating card:', error);
        // Return the error
        throw error;
    }
}

/**
 * Create a new label on a Trello board
 * @param labelName - The name of the label
 * @param color - The color of the label, defaults to default
 * @returns {Promise<any>} - The response from the API
 */
async function createLabel(boardName, labelName, color = "default", guildId) {
    try {
        // Create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloNodeInstance: true });

        // Get the board ID from the board name
        const boardId = await getBoardId(boardName, guildId);

        // Check that all required parameters are provided
        if (!boardId || !labelName) {
            throw new Error('Missing required parameters for creating a label');
        }

        // Check if TRELLO_BOARD_ID is a valid Trello board ID
        if (!/^[\da-f]{24}$/i.test(boardId)) {
            throw new Error('Invalid Trello board ID');
        }

        color = convertToTrelloColor(color).name;
        
        // Create a new label data object
        const labelData = {name: labelName, color, idBoard: boardId };

        // Make an API request to create a new label and return it
        return await trello.label.create(labelData);

    // Error handling
    } catch (error) {
        console.error('Error creating label:', error);
        // Return the error
        throw error;
    }
}

/**
 * Create a new list on a Trello board
 * @param listName - The name of the list
 * @returns {Promise<unknown>} - The response from the API
 */
async function createList(boardName, listName, guildId) {
    try {
        // Create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

        // Get the board ID from the board name
        const boardId = await getBoardId(boardName, guildId);

        // Make an API request to create a new list
        return await trello.addListToBoard(boardId, listName);

    // Error handling
    } catch (error) {
        console.error('Error creating list:', error);
        
        // Return the error
        throw error;
    }
}

/**
 * Get every lists on a Trello board
 * @returns {Promise<*>} - All lists on the Trello board
 */
async function getAllList(boardName, guildId) {
    try {
        // Create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

        // Get the board ID from the board name
        const boardId = await getBoardId(boardName, guildId);

        // Make an API request to create a new list
        return await trello.getListsOnBoard(boardId).then(lists => lists.map(list => list.name));
    // Error handling
    } catch (error) {
        console.error('Error getting all lists:', error);
        // Return the error
        throw error;
    }
}

/**
 * Get all cards in a specific list
 * @param listName - The name of the list
 * @returns {Promise<*>} - A list of all cards in the list
 */
async function getAllCardsInList(boardName, listName, guildId) {
    try {
        // Create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

        // Get the board ID from the board name
        const boardId = await getBoardId(boardName, guildId);

        // Get the list ID from the list name
        const listId = await getListIdByName(boardId, listName, guildId);

        // Make an API request to create a new list
        return await trello.getCardsOnList(listId);

    // Error handling
    } catch (error) {
        console.error('Error getting all cards in specific list', error);
        // Return the error
        throw error;
    }
}

/**
 * Get the ID of a list on a Trello board by its name
 * @param boardId - The ID of the board
 * @param listName - The name of the list
 * @returns {Promise<*>} - The ID of the list
 */
async function getListIdByName(boardId, listName, guildId) {
    try {
        // Create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

        // Get all lists on the board
        const lists = await trello.getListsOnBoard(boardId);

        // Find the list with the matching name
        const list = lists.find(list => list.name === listName);

        // If the list was found, return its ID
        if (list) {
            return list.id;
        // If the list was not found, throw an error
        } else {
            throw new Error(`List "${listName}" not found on board "${boardId}"`);
        }
    // Error handling
    } catch (error) {
        console.error('Error getting list ID:', error);
        // Return the error
        throw error;
    }
}

/**
 * Delete a list on Trello
 * @param listName
 * @returns {Promise<void>} - The response from the API
 */
async function deleteList(boardName, listName, guildId) {
    // Get api key and token
    const [apiKey, apiToken] = await getTrelloData(guildId, { includeTokens: true });

    // Get the board ID from the board name
    const boardId = await getBoardId(boardName, guildId);

    // Get the list id by name
    const listId = await getListIdByName(boardId, listName, guildId);

    // Make an API request to delete (archive) the list
    return await fetch(`https://api.trello.com/1/lists/${listId}/?closed=true&key=${apiKey}&token=${apiToken}`, {
        method: 'PUT'
    })
        // Convert the response to text and return it
        .then(response => {
            return response.text();
        })
        // Error handling
        .catch (error => console.error('Error could not delete list:' + error));
}

/**
 * Deletes a specific card on a list in Trello
 * @param listName - The name of the list
 * @param cardName - The name of the card
 * @returns {Promise<void>} - The response from the API
 */
async function deleteCard(boardName, listName, cardName, guildId) { 
    try {
        // Create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

        // Get the board ID from the board name
        const boardId = await getBoardId(boardName, guildId);

        const listId = await getListIdByName(boardId, listName, guildId); // Get the list ID
        const cards = await trello.getCardsOnList(listId); // Get all cards in the list
        const card = cards.find(card => card.name.toLowerCase() === cardName.toLowerCase()); // Find the specific card

        // Deletes the card if it exists.
        if (card) {
             return await trello.deleteCard(card.id);
        // Throws an error if the card does not exist.
        } else {
            throw new Error(`${card} was not found in ${listName}`);
        }
    // Error handling
    } catch (error) {
        console.error('Error deleting card:', error);
        throw error;
    }
}

/**
 * Assign a member to a card on Trello
 * @param memberName - The name of the member
 * @param cardName - The name of the card
 * @returns {Promise<*>} - The response from the API
 */
async function assignMember(boardName, memberName, cardName, guildId){
    try {
        // Create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

        // Get the board ID from the board name
        const boardId = await getBoardId(boardName, guildId);

        // Find a match between typed name and name on Trello
        const member = await trello.getBoardMembers(boardId)
            .then(members => members.find(member => member.fullName === memberName)) // member: id, fullname, username

        // Find a match between typed card name and card name on Trello.
        const cards = await trello.getCardsOnBoard(boardId)
            .then(cards => cards.filter(card => card.name.toLowerCase() === cardName.toLowerCase()))
            .then(cards => cards.map(card => ({cardId: card.id, cardName: card.name, memberIds: card.idMembers}))); // card: id, name, idMembers

       // If there are more than one card with the same name
        if (cards.length > 1) {

            // iterate through the cards and assign the member to the first card which the member is not on.
            for(let i = 0; i < cards.length; i++) {
               if (!cards[i].memberIds.includes(member.id)) {
                   // Assign the given member to the first card which the member is not on.
                   return await trello.addMemberToCard(cards[i].cardId, member.id);
               }
           }
            // If the member is already assigned to all cards with the name: cardName
            throw new Error(`The member: ${memberName} is already assigned to all cards with the name: ${cardName} on the board ${boardId}`);

        // If there is only one card with the name: cardName, assign the member to the card.
        } else {
            // If the member is not assigned to the card then assign the member to the card.
            if (!cards[0].memberIds.includes(member.id)) {

                // Assign the given member to the given card.
                return await trello.addMemberToCard(cards[0].cardId, member.id);
                
            // If the member is already assigned to the card then throw an error.
            } else {
                throw new Error(`The member: ${memberName} is already assigned to the card: ${cardName}`);
            }
        }
    // Error handling
    } catch (error) {
        console.error('Error when assigning member', error);
        // Return the error
        throw error;
    }

}

/**
 * Resign a member from a card on Trello
 * @param memberName - The name of the member
 * @param cardName - The name of the card
 * @returns {Promise<*>} - The response from the API
 */
async function resignMember(boardName, memberName, cardName, guildId) {
    try {
        // Create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

        // Get the board ID from the board name
        const boardId = await getBoardId(boardName, guildId);

        // Find a match between typed name and name on Trello
        const member = await trello.getBoardMembers(boardId)
            .then(members => members.find(member => member.fullName === memberName)) // member: id, fullName, username

        // Find a match between typed card name and card name on Trello.
        const cards = await trello.getCardsOnBoard(boardId)
            .then(cards => cards.filter(card => card.name.toLowerCase() === cardName.toLowerCase()))
            .then(cards => cards.map(card => ({cardId: card.id, cardName: card.name, memberIds: card.idMembers}))); // card: id, name, idMembers

        // If there are more than one card with the same name
        if (cards.length > 1) {
            // Iterate through the cards and resign the member from the first card which the member is on.
            for (let i = 0; i < cards.length; i++) {
                if (cards[i].memberIds.includes(member.id)) {

                    // Resign the given member from the given card.
                    return await trello.delMemberFromCard(cards[i].cardId, member.id);
                }
            }
            // If the member is not assigned to any cards with the name: cardName
            throw new Error(`The member: ${memberName} is not assigned to any cards with the name: ${cardName} on the board ${boardId}`);

        } else {
            if (cards[0].memberIds.includes(member.id)) {
                // Resign the given member from the card
                return await trello.delMemberFromCard(cards[0].cardId, member.id);
            } else {
                throw new Error(`The member: ${memberName} is not assigned to the card: ${cardName}`);
            }
        }
    // Error handling
    } catch (error) {
        console.error('Error when resigning member', error);
        throw error;
    }
}

/**
 * Get all members of a Trello Board
 * @returns {Promise<*>} - A list of all members on the Trello Board
 */
async function getAllMembers(boardName, guildId) {
    try {
        // Create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

        // Get the board ID from the board name
        const boardId = await getBoardId(boardName, guildId);
        
        // Get all members of a Trello Board
      return await trello.getBoardMembers(boardId)
          .then(members => members.map(member => member.fullName));

      // Error handling
    } catch (error) {
        console.error('Error getting all members', error);
    }
}

/**
 * Get all cards assigned to a member
 * @param memberName - The name of the member
 * @returns {Promise<*>} - A list of cards id assigned to the member
 */
async function getCardsAssignedToMember(boardName, memberName, guildId) {
    try {
        // Create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

        // Get the board ID from the board name
        const boardId = await getBoardId(boardName, guildId);

        // Find a match between given name and name on Trello
        const member = await trello.getBoardMembers(boardId)
            .then(members => members.find(member => member.fullName === memberName));

        // Get all cards assigned to the member on a Trello Boa   rd
        return await trello.getMemberCards(member.id)
            .then(cards => cards.filter(card => card.idBoard === boardId)
            .map(card => card.name));
    // Error handling
    } catch (error) {
        console.error('Error getting all cards assigned to member', error);
    }
}

/**
 * Get all cards that a member is assigned to
 * @param memberName - The name of the member
 * @returns {Promise<*>} - A list of cards that the member is not on
 */
async function getCardsMemberIsNotOn(boardName, memberName, guildId) {
    if (memberName !== null) {
        try {
            // Create a new trello instance
            const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

            // Get the board ID from the board name
            const boardId = await getBoardId(boardName, guildId);

            // Find a match between given name and name on Trello
            const member = await trello.getBoardMembers(boardId)
                .then(members => members.find(member => member.fullName === memberName));

            // Get all cards assigned to the member on a Trello Board
            const assignedCardIds = await trello.getMemberCards(member.id)
                .then(cards => cards.filter(card => card.idBoard === boardId)
                    .map(card => card.id));

            // Get all cards on the board - filter out the cards assigned to the member
            return await trello.getCardsOnBoard(boardId)
                .then(cards => cards.filter(all => !assignedCardIds.some(assigned => all.id === assigned)))
                .then(cards => cards.map(card => card.name));

            // Error handling
        } catch (error) {
            console.error('Error getting all cards member is not on', error);
        }
    }
}

/**
 * Move a card from one list to another
 * @param fromList - The name of the list you want to move from
 * @param cardName - The name of the card you want to move
 * @param toList - The name of the list you want to move to
 * @returns {Promise<string|void>} - The response from the API
 */
async function moveCard(boardName, fromList, cardName, toList, guildId) {
    // Create a new trello instance
    const [trello] = await getTrelloData(guildId, { createTrelloInstance: true });

    // Get the board ID from the board name
    const boardId = await getBoardId(boardName, guildId);

    // Get the list ID of the list you want to move from
    const toListId = await trello.getListsOnBoard(boardId)
        .then(lists => lists.filter(list => list.name === toList))
        .then(lists => lists.map(list => list.id));

    // Get every card id in list (if more than one return the first)
    const cardId = await getAllCardsInList(boardName, fromList, guildId)
        .then(cards => cards.filter(card => card.name.toLowerCase() === cardName.toLowerCase()))
        .then(cards => cards.map(card => card.id))
        .then(card => card[0]); // If there is more than one card with the same name (not case sensitive), take the first one.

    // 
    const [apiKey, apiToken] = await getTrelloData(guildId, { includeTokens: true });

    // Move the card
    const response = await fetch(`https://api.trello.com/1/cards/${cardId}/?idList=${toListId}&key=${apiKey}&token=${apiToken}`, {
        method: 'PUT'
    })
        .then(response => {
            return response.text();
        }) 
        // Error handling
        .catch (error => console.error('Error could not move card: ' + error));

    // Return the response
    return response;
}

/**
 * - Get all labels in a specific board
 * @param {string} boardName The name of the board
 * @param {string} guildId The ID of the guild
 * @returns {Promise<[string]>}
 */
async function getLabelsInBoard(boardName, guildId) {
    try {
    // Create a new trello instance
    const [trello] = await getTrelloData(guildId, { createTrelloInstance: true});

    // Get boardId
    const boardId = await getBoardId(boardName, guildId);

    // If no board was found throw error
    if (!boardId) {
        throw new Error(`No board with name ${boardName}`);
    }

    // Get every label name on board.
    const labels = await trello.getLabelsForBoard(boardId);
    
    // If no label was found throw error
    if (!labels) {
        throw new Error(`No labels found on board ${boardName}`);
    }

    // Return every label on board
    return labels;

    // Error handling
    } catch (error) {
        console.error('Error getting labels in board ' + error);
        throw error;
    }
}

/**
 * - Get the ID of a specific label
 * @param {string} boardName - The name of the board
 * @param {string} labelName - The name of the label
 * @param {string} guildId - The ID of the guild
 * @returns {Promise<striing>} - The label first labelId matching labelName
 */
async function getLabelId(boardName, labelName, guildId) {
    try {
        // Get the labelId (if more than one) return the first.
        const labelId = await getLabelsInBoard(boardName, guildId)
        .then(labels => labels.filter(label => label.name === labelName))
        .then(labels => labels[0].id);
        
        // If no labelId was found throw an error
        if (!labelId) {
            throw new Error(`No label could be found with name ${labelName}`);
        }
        
        // Return the labelId
        return labelId;
    
    // Error handling
    } catch (error) {
        console.error('Error getting label id ' + error);
        throw error;
    }
}

/**
 * - Assign a label to a card on a board
 * @param {string} boardName - The name of the board
 * @param {string} listName - The name of the list where the card is
 * @param {string} cardName - The name of the card
 * @param {string} labelName - The name of the card
 * @param {string} guildId - The ID of the guild
 */
async function assignLabel (boardName, listName, cardName, labelName, guildId) {
    try {
        // Create a new trello instance
        const [trello] = await getTrelloData(guildId, { createTrelloInstance: true});
        
        // Get the label id
        const labelId = await getLabelId(boardName, labelName, guildId);
    
        // Get every card and filter to the first card
        const cardId = await getAllCardsInList(boardName, listName, guildId)
        .then(cards => cards.filter(card => card.name.toLowerCase() === cardName.toLowerCase()))
        .then(cards => cards.map(card => card.id))
        .then(card => card[0]);
    
        // Add the label to the card
        await trello.addLabelToCard(cardId, labelId);
        
    // Error handling
    } catch (error) {
        console.error("Error assigning label to card:", error);
        throw error;
    }
}

// Export the functions
export { createCard, createList, getAllList, getAllMembers, createLabel, deleteList, deleteCard, getListIdByName, assignMember,
         resignMember, getCardsAssignedToMember, getCardsMemberIsNotOn, getAllCardsInList, moveCard, getEveryBoardName, getLabelsInBoard,
         assignLabel };