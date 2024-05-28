// Require google from googleapis package
import { google } from 'googleapis'
import { addDays, isExists} from 'date-fns';
import { getIntegrationId, getToken } from '../database/database.js';

// Require oAuth2 from our google instance
const { OAuth2 } = google.auth;

/**
 * - Get calendar data
 * @param {string} guildId - The ID of the guild
 * @param {object} options - Possible options: includeCalendarId, includeCalendarInstance
 * @returns {Promise<[object]>} - The data which was asked for
 */
async function getCalendarData(guildId, options = {}) {
    try {
        // Get integration ID
        const integrationId = await getIntegrationId(guildId, "googlecalendar");

        // Get the tokens
        const clientId = await getToken(integrationId, "Client ID");
        const secretId = await getToken(integrationId, "Client Secret");
        const tokenId = await getToken(integrationId, "Token");
        const calendarId = await getToken(integrationId, "Calendar ID");

        if (!integrationId || !clientId || !secretId || !tokenId || !calendarId) {
            throw  new Error("Error getting calendar data for guild", guildId);
        }

        let calendarData = [];

        if (options.includeCalendarId) {
            // Add the calendar ID to the array
            calendarData.push(calendarId);
        }

        if (options.includeCalendarInstance) {
            // Create OAuth2Client
            const oAuth2Client = new OAuth2(clientId, secretId);
            oAuth2Client.setCredentials({
                refresh_token: tokenId
            });

            // Create calendar instance
            const calendar = google.calendar({ version: 'v3', auth: oAuth2Client});
            
            // Add the calendar instance to the array
            calendarData.push(calendar);
        }

        return calendarData;
    } catch (error) {
        console.error(error);
    }
}

/**
 * @description List events from the Google Calendar.
 * @param {string, int} amount - The amount of events to list.
 * @returns {object} An object containing the upcoming events
 */
async function listEvents(amount, guildId) {
    try {
        // Get the calendar ID and a calendar instance
        const [calendarId, calendar] = await getCalendarData(guildId, { includeCalendarId: true, includeCalendarInstance: true});
        
        // Get the events from the calendar
        const res = await calendar.events.list({
            calendarId: calendarId,
            timeMin: new Date().toISOString(),
            maxResults: amount || undefined, // Set maxResults to undefined to retrieve all events
            singleEvents: true,
            orderBy: 'startTime',
        });

        // Get the events from the response
        const events = res.data.items;

        // If there are no events, throw an error
        if (!events || events.length === 0) {
            throw new Error('No upcoming events found.');
        }

        return events;
    } catch (err) {
        console.error('There was an error listing the events: ' + err);
        throw err;
    }
}

/**
 * @description Delete an event in the Google Calendar by name and date.
 * @param {string} eventName - The name of the event.
 * @param {date} date - The date of the event. in the format of yyyy-mm-dd or yyyy-mm-ddTHH:MM:SS.
 * @returns {object} The event object.
 */
async function deleteEvent(eventName, date, guildId) {
    try {
        // Get the calendar ID and a calendar instance
        const [calendarId, calendar] = await getCalendarData(guildId, { includeCalendarId: true, includeCalendarInstance: true});

        // Get the event, and all information about it
        const eventInfo = await getEvent(eventName, date, guildId);

        // Delete the event and throw an error if it fails
        calendar.events.delete({
            calendarId: calendarId,
            eventId: eventInfo.id,
            }, (err) => {
            if (err) {
                console.error('There was an error deleting the Calendar event: ' + err);
                throw err;
            }
            console.log('Event deleted');
        });
   
        return eventInfo;
    } catch (err) {
        console.error('There was an error deleting the event: ' + err);
        throw err;
    }
}

/**
 * @description Create an event in the Google Calendar.
 * @param {string} title - The title of the event.
 * @param {string} desc - The description of the event.
 * @param {string} yyyy - The year of the event.
 * @param {string} mm - The month of the event.
 * @param {string} dd - The day of the event.
 * @param {string} hours - The hours of the event.
 * @param {string} minutes - The minutes of the event.
 * @param {string} durationHour - The duration hours of the event.
 * @param {string} durationMinutes - The duration minutes of the event.
 * @param {boolean} fullDay - If the event is a full day event.
 * @returns {object} event - An object containing the created event.
 */
async function createEvent(title, desc, yyyy, mm, dd, hours, minutes, durationHour, durationMinutes, fullDay, guildId){
    // Get the calendar ID and a calendar instance
    const [calendarId, calendar] = await getCalendarData(guildId, { includeCalendarId: true, includeCalendarInstance: true});

    // Set the default event configuration, and rename for simplicity
    let cfg = defaultEventConfig(title, desc, yyyy, mm, dd, hours, minutes, durationHour, durationMinutes, fullDay);

    // Create the event start and end objects
    let eventStart = {};
    let eventEnd = {};

    // Check if the event is a full-day event
    if (fullDay){
        eventStart = {
            'date': cfg.yyyy + '-' + cfg.mm + '-' + cfg.dd,
            'timeZone': 'CET',
        };
        eventEnd = {
            'date': cfg.yyyy + '-' + cfg.mm + '-' + cfg.dd,
            'timeZone': 'CET',
        };
    } else {
        eventStart = {
            'dateTime': cfg.yyyy + '-' + cfg.mm + '-' + cfg.dd + 'T' + cfg.hours + ':' + cfg.minutes + ':00',
            'timeZone': 'CET',
        };
        eventEnd = {
            'dateTime': convertTime(cfg.yyyy, cfg.mm, cfg.dd, cfg.hours, cfg.minutes, cfg.durationHour, cfg.durationMinutes) + ':00',
            'timeZone': 'CET',
        };
    }
    // Create the event object
    const event = {
        'summary': cfg.title,
        'description': cfg.desc,
        'start': eventStart,
        'end': eventEnd,
    };
    
    // Insert the event object into the selected calendar and throw an error if it fails
    calendar.events.insert({
        calendarId: calendarId,
        resource: event,
        }, (err, event) => {
        if (err) {
            console.error('There was an error contacting the Calendar service: ' + err);
            return err;
        }
        cfg.calendarLink = event.data.htmlLink;
        console.log('Event created: %s', cfg.calendarLink);
    });

    return cfg;
}

/** 
 * @description Get an event from the Google Calendar by name and date.
 * @param {string} eventName - The name of the event.
 * @param {string} date - The date of the event.
 * @returns {object} - The event object.
 */
async function getEvent(eventName, date, guildId) {
    try{
        // Get the calendar ID and a calendar instance
        const [calendarId, calendar] = await getCalendarData(guildId, { includeCalendarId: true, includeCalendarInstance: true});

        // Insert all events into res
        const res = await calendar.events.list({
            calendarId: calendarId,
            timeMin: date ? new Date(date).toISOString() : undefined,
            singleEvents: true,
            orderBy: 'startTime',
        });
        
        let filteredEvents = res.data.items;
        // Filter the events by date if a date is given
        // if statement to check if the event is a full day or not
        if (date.length > 10){
            if (date) {
                filteredEvents = res.data.items.filter(item => {
                    return new Date(item.start.dateTime).toDateString() === new Date(date).toDateString();
                });
            }
        } else {
            if (date) {
                filteredEvents = res.data.items.filter(item => {
                    return new Date(item.start.date).toDateString() === new Date(date).toDateString();
                });
            }
        }
        
        // Then find the event with the matching name
        const eventInfo = filteredEvents.find(item => {
            return item.summary === eventName;
        });
        
        // If the event is not found, throw an error
        if (!eventInfo) {
            throw new Error("No event, with the given name and date, found");
        }
        
        return eventInfo;
    } catch (err) {
        console.error('There was an error fetching event by name or date: ' + err);
        throw err;
        // Return the event
    }
}

/**
 * @description Set the default event configuration.
 * @param {string} title 
 * @param {string} desc 
 * @param {string} yyyy 
 * @param {string} mm 
 * @param {string} dd 
 * @param {string} hours 
 * @param {string} minutes 
 * @param {string} durationHour 
 * @param {string} durationMinutes 
 * @param {boolean} fullDay
 * @returns {object} The default event object.
 */
function defaultEventConfig(title, desc, yyyy, mm, dd, hours, minutes, durationHour, durationMinutes, fullDay){
    // Initialize the event configuration object
    let eventConfig = {
        title: title,
        desc: desc,
        yyyy: yyyy,
        mm: mm,
        dd: dd,
        hours: hours,
        minutes: minutes,
        durationHour: durationHour,
        durationMinutes: durationMinutes,
    }
    
    // Check if the event is a full day event and disables the settings regarding duration and time
    if (!fullDay){
        // Check if both hour and minute duration is set and default to 1 hour, if not set
        if ((eventConfig.durationHour === undefined && eventConfig.durationMinutes === undefined) || (durationHour === null && durationMinutes === null)) {eventConfig.durationHour = 1;}
        // Check if the minute duration is set and default to 0 minutes
        if (eventConfig.durationMinutes === undefined || eventConfig.durationMinutes === null) {eventConfig.durationMinutes = 0;}
         // If both minutes and hours are undefined, set minutes to the current minutes
        if ((eventConfig.minutes === undefined || eventConfig.minutes === null) && (eventConfig.hours === undefined || eventConfig.hours === null))      {eventConfig.minutes = new Date().getMinutes();}
        // If hours are undefined, set hours to the current hours
        if (eventConfig.hours === undefined || eventConfig.hours === null)      {eventConfig.hours = new Date().getHours();}
        // If minutes are undefined, set minutes to 00 (Only happens if hours are set, due to if statement defined three lines above )
    if (eventConfig.minutes === undefined || eventConfig.minutes === null)  {eventConfig.minutes = '00';}
    }
    // Check if the date is set and default to the current date
    if (eventConfig.yyyy === undefined || eventConfig.yyyy === null)        {eventConfig.yyyy = new Date().getFullYear();}
    if (eventConfig.mm === undefined || eventConfig.mm === null)            {eventConfig.mm = (new Date().getMonth() + 1);} // +1 due to 0-index
    if (eventConfig.dd === undefined || eventConfig.dd === null)            {eventConfig.dd = new Date().getDate();}
   // Make sure the month is written with two digits
    if (eventConfig.mm.length === 1) {eventConfig.mm = '0' + eventConfig.mm;}
    
    // Check if the date is existing (parseInt to ensure it isExists works)
    if (!isExists(parseInt(eventConfig.yyyy), parseInt(eventConfig.mm), parseInt(eventConfig.dd))){
        console.log('Invalid date');
        throw new Error('Invalid date');
    }
    if (eventConfig.title === undefined) {
        throw new Error('Title undefined');
    }
    return eventConfig;
}

/**
 * @description Convert the time and set it to the correct format.
 * @param {string} yyyy 
 * @param {string} mm 
 * @param {string} dd 
 * @param {string} hours 
 * @param {string} minutes 
 * @param {string} durationHour 
 * @param {string} durationMinutes 
 * @returns {string} The new date and time in the format of {yyyy}-{mm}-{dd}T{hours}:{minutes}.
 */
function convertTime(yyyy, mm, dd, hours, minutes, durationHour, durationMinutes) {
    // Uses the library date-fns to add days to the date. And new Date is a built-in function in JavaScript
    let newDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd)); // -1 due to 0-index
    let additionalMinutes = parseInt(durationMinutes) + parseInt(minutes);
    let additionalHours = parseInt(durationHour) + parseInt(hours);
    if (additionalMinutes >= 60) {
        additionalHours += Math.floor(additionalMinutes / 60);
        additionalMinutes = additionalMinutes % 60;
    }
    
    newDate = addDays(newDate, Math.floor(additionalHours / 24));
    let newHours = additionalHours % 24;
    let newDay = newDate.getDate();
    let newMonth = newDate.getMonth() + 1; // +1 due to 0-index
    let newYear = newDate.getFullYear();
    return newYear + '-' + newMonth + '-' + newDay + 'T' + newHours + ':' + additionalMinutes;
}

// Export the functions
export {createEvent, listEvents, deleteEvent};
