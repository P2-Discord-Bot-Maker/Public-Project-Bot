import { createCard, createList, createLabel, deleteList, deleteCard, assignMember, resignMember, getAllCardsInList, moveCard,assignLabel } from '../src/backend/trello.js';
import assert from 'assert';

const BOARD = {
  name: "P2",
  id: process.env.TRELLO_BOARD_ID
};
const LIST1 = {
  name: "Mocha test list 1",
  id: "664b77d30e34ca5710cb5273"
};
const LIST2 = {
  name: "Mocha test list 2",
  id: "65c628323c3b6a6e52d39b43"
};
const CARD = {
  name: "Mocha test card"
};
const LABEL = {
  name: "Mocha test label",
  color: "green"
};
const MEMBER = {
  name: "Kristoffer Holm"
};
const GUILD = {
  id: process.env.DISCORD_GUILD_ID
};

describe('Trello', function() {
   // Set the execute time limit for each test (in ms)
  this.timeout(10000);
  
  // Test for the createCard function
  describe('Create card', function() {
    it('Should create a card', async function() {
      // Create a card, retuns an object
      const card = await createCard(BOARD.name, LIST1.name, CARD.name, GUILD.id);
      // Check if the card is in the correct board
      assert.strictEqual(card.idBoard, BOARD.id);
      // Check if the card has the correct name
      assert.strictEqual(card.name, CARD.name);
      // Check if the card is in the correct list
      assert.strictEqual(card.idList, LIST1.id);
    });
  });
  
  // Test for the createLabel function
  describe('Create label', function() {
    it('Should create a label', async function() {
      // Create a label, returns an object
      const label = await createLabel(BOARD.name, LABEL.name, LABEL.color, GUILD.id);

      // Check if the label has the correct name
      assert.strictEqual(label.name, LABEL.name);
      // Check if the label has the correct color
      assert.strictEqual(label.color, LABEL.color);
      // Check if the label has been added to the correct board
      assert.strictEqual(label.idBoard, BOARD.id);
    });
  });
  
  // Test for the assignLabel function
  describe('Assign label', function() {
    it('Should assing label to card', async function() {
      // Assign a label to a card, if successful returns nothing
      await assignLabel(BOARD.name, LIST1.name, CARD.name, LABEL.name, GUILD.id);
    });
  });

  // Test for the assignMember function
  describe('Assign member', function() {
    it('Should assign a member to a card', async function() {
      // Assign a member to a card, returns an object within an array (because the member is assigned to the first card matching the name, that they are not already assigned to)
      const member = await assignMember(BOARD.name, MEMBER.name, CARD.name, GUILD.id);

      // Check if the members full name is correct
      assert.strictEqual(member[0].fullName, MEMBER.name);
    });
  });

  // Test for the resignMember function
  describe('Resign member', function() {
    it('Should resign a member from a card', async function() {
      // Resign a member from a card, if successful returns nothing
      await resignMember(BOARD.name, MEMBER.name, CARD.name, GUILD.id);
    });
  });

  // Test for the moveCard function
  describe('Move card', function() {
    it('Should move a card', async function() {
      // Move a card to another list, if successful returns nothing
      await moveCard(BOARD.name, LIST1.name, CARD.name, LIST2.name, GUILD.id);
    });
  });
  
  // Test for the deleteCard function
  describe('Delete card', function() {
    it('Should delete a card', async function() {
      // Delete a card, if successful returns nothing
      await deleteCard(BOARD.name, LIST2.name, CARD.name, GUILD.id);
    });
  });

  // Test for the getAllCardsInList function
  describe('List cards', function() {
    it('Should list all cards in a list', async function() {
      // Get all cards in a list, returns an array of objects
      const cards = await getAllCardsInList(BOARD.name, LIST1.name, GUILD.id);

      for (const card of cards) {
        // Check if the cards are in the correct board
        assert.strictEqual(card.idBoard, BOARD.id);
        // Check if the cards are in the correct list
        assert.strictEqual(card.idList, LIST1.id);
        // Console log the cards
        console.log(card.name);
      }
    });
  });
  
  // Test for the createList function
  describe('Create list', function() {
    it('Should create a list', async function() {
      // Create a list, returns an object
      const list = await createList(BOARD.name, "Mocha test", GUILD.id);
      
      // Check if the list is in the correct board
      assert.strictEqual(list.idBoard, BOARD.id);
      // Check if the list has the correct name
      assert.strictEqual(list.name, 'Mocha test');
    });
  });
  
  // Test for the deleteList function
  describe('Delete list', function() {
    it('Should delete a list', async function() {
      // Delete a list, if successful returns nothing
      await deleteList(BOARD.name, "Mocha test", GUILD.id);
    });
  });
});