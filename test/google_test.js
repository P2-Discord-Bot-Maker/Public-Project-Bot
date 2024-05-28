import { createEvent, listEvents, deleteEvent } from '../src/backend/calendar.js';
import assert from 'assert';

const EVENT = {
  title: 'Mocha test event',
  desc: 'This event has been created using Mocha for the purpose of testing the command',
  yyyy: '2024',
  mm: '05',
  dd: '24',
  hours: '18',
  minutes: '30',
  durationHour: '2',
  durationMinutes: '30',
  fullDay: false
};
const GUILD = {
  id: process.env.DISCORD_GUILD_ID
};

describe('Google Calendar', function() {
  // Set the execute time limit for each test (in ms)
  this.timeout(10000);
   
  // Test for the createEvent function
  describe('Create event', function() {
    it('Should create an event', async function() {  
      // Run the createEvent function
      const createdEvent = await createEvent(EVENT.title, EVENT.desc, EVENT.yyyy, EVENT.mm, EVENT.dd, EVENT.hours, EVENT.minutes, EVENT.durationHour, EVENT.durationMinutes, EVENT.fullDay, GUILD.id);
      
      // Check if createdEvent has the expected values
      assert.strictEqual(createdEvent.title, EVENT.title);
      assert.strictEqual(createdEvent.desc, EVENT.desc);
      assert.strictEqual(createdEvent.yyyy, EVENT.yyyy);
      assert.strictEqual(createdEvent.mm, EVENT.mm);
      assert.strictEqual(createdEvent.dd, EVENT.dd);
      assert.strictEqual(createdEvent.hours, EVENT.hours);
      assert.strictEqual(createdEvent.minutes, EVENT.minutes);
      assert.strictEqual(createdEvent.durationHour, EVENT.durationHour);
      assert.strictEqual(createdEvent.durationMinutes, EVENT.durationMinutes);
    });
  });
  
  // Test of the listEvents function
  describe('List events', function() {
    it('Should list every event', async function() {
      // Get the names of every event
      const upcomingEvents = await listEvents(undefined, GUILD.id)
      .then(events => events.map(event => event.summary));
    
      // Print the events   
      console.log(upcomingEvents);

      // Check if the created event before is in the list
      assert.strictEqual(upcomingEvents.includes(EVENT.title), true);
    });
  });
  
  // Test of the deleteEvent function
  describe('Delete Event', function() {
    it('Should delete an event', async function() {
      // Convert the time to the right format
      const time = EVENT.yyyy + '-' + EVENT.mm + '-' + EVENT.dd + 'T' + EVENT.hours + ':' + EVENT.minutes;

      // Delete the event
      const deletedEvent = await deleteEvent(EVENT.title, time, GUILD.id);
      
      // Check if the deleted event has the expected values
      assert.strictEqual(deletedEvent.summary, EVENT.title);
      assert.strictEqual(deletedEvent.description, EVENT.desc);
      
      // The seconds of the event and the timezone
      const timeZone = ':00+02:00';
      assert.strictEqual(deletedEvent.start.dateTime, time + timeZone);
    });
  });
});
