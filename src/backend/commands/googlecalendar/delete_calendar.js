import Discord, {EmbedBuilder} from 'discord.js'
import {deleteEvent, listEvents} from '../../calendar.js'
// Discord command to delete an event from the calendar
export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('cdelete')
        .setDescription('deletes an event on P2 calendar')
        // Subcommand to delete an event
        .addSubcommand(
            subcommand =>
            subcommand
                .setName('event')
                    .setDescription('delete an event')
                    .addStringOption(
                        option =>
                        option.setName('title')
                        .setDescription('Title of the Event you want to delete')
                        .setRequired(true)
                        .setAutocomplete(true))
                    .addStringOption(
                        option =>
                        option.setName('date')
                        .setDescription('Date of the Event you want to delete')
                        .setRequired(true)
                        .setAutocomplete(true))
        ),
        
        async autocomplete(interaction){    
            // The active field on Discord.
            const focusedOption = interaction.options.getFocused(true);
            // Get the focused value from the user
            const focusedValue = interaction.options.getString('title'); 
            // Get the guild ID from the interaction
            const guildId = interaction.guildId;

            let choices, filtered;
           
            try {
                if (focusedOption.name === 'title') {
                    // Get the list of events from the calendar
                    choices = await listEvents(undefined, guildId).then(lists => lists.map(list => list.summary));

                    if (choices.length === 0) {
                        throw new Error('No events found');
                    }
                    
                    // Filter the choices based on the focused value
                    filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));

                    if (filtered.length > 25) {
                        filtered = filtered.slice(0, 25);
                    }

                    await interaction.respond(
                        filtered.map(choice => ({ name: choice, value: choice })),
                    );
                } if (focusedOption.name === 'date') {
                    // Get the list of events from the calendar
                    choices = await listEvents(undefined, guildId);

                    if (choices.length === 0) {
                        throw new Error('No events found');
                    }
                
                    // Filter the events based on the title
                    const title = interaction.options.getString('title');
                    filtered = choices.filter(event => event.summary.toLowerCase() === title.toLowerCase());

                    if (filtered.length > 25) {
                        filtered = filtered.slice(0, 25);
                    }
                
                    // Map the filtered events to their dates, and furthermore whether they are full-day events or not
                    const dates = filtered.map(event => event.start.date || event.start.dateTime);
                
                    // Respond with the dates (name is the display and value is the actual value)
                    await interaction.respond(
                        // .substring(0, 16) removes the seconds and time zone from the date
                        dates.map(date => ({ name: date.substring(0, 16).replace('T', ' at '), value: date })),
                    );
                }
                
            } catch (error) {
                console.error('Error in autocomplete: ' + error);
                await interaction.respond([{name: 'Error', value: 'An error occurred while loading the options'}]);
            };
            
        },

    /**
     * @description Executes the delete calendar command.
     * @param {Discord.CommandInteraction} interaction - The interaction object representing the command interaction.
     * @returns {Promise<void>} A promise that resolves when the command execution is complete.
     */
    async execute(interaction){
        // Get the event details from the interaction (user inputs)
        const title = interaction.options.getString('title');
        const date = interaction.options.getString('date');
        const guildId = interaction.guildId;
        const startTime = Date.now(); // Start time for the command
        let elapsedTime; // Variable to store the time taken to execute the command
        await interaction.deferReply(); // Defer the reply

        try {
            let deletedEvent = await deleteEvent(title, date, guildId);
            // To convert date format to match
            let eventDate = new Date(deletedEvent.start.dateTime || deletedEvent.start.date);
            
            // Define the fields for the embed message
            let fields = [
                {name: 'Title', value: deletedEvent.summary},
                {name: 'Description', value: deletedEvent.description || 'No description provided'},
                {name: 'Date', value: eventDate.getFullYear() + '-' + (eventDate.getMonth() + 1).toString().padStart(2, '0') + '-' + eventDate.getDate().toString().padStart(2, '0'), inline: true},
                
            ];
            
            // Check if the event is an all-day event or not
            if (deletedEvent.start.dateTime) {
                fields.push({name: 'Time', value: eventDate.getHours().toString().padStart(2, '0') + ':' + eventDate.getMinutes().toString().padStart(2, '0'), inline: true},);
            } else {
                fields.push({name: 'Time', value: 'Full-day event', inline: true})
            }

            elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

            // Create embed message. Using .toString().padStart(2, '0') to ensure that the date and time are always two digits.
            const embedDelete = new EmbedBuilder()
                .setTitle('Calendar event deleted')
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/1024px-Google_Calendar_icon_%282020%29.svg.png')
                .setColor('#FFA500') // Change the color to orange (#FFA500)
                .setFields(fields)
                .setFooter({ text: `Done in ${elapsedTime} seconds`});
            await interaction.editReply({embeds: [embedDelete]});
        } catch (error) {
            const embedError = new EmbedBuilder()
                .setTitle('Error deleting event')
                .setDescription('Error: ' + error.message)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/1024px-Google_Calendar_icon_%282020%29.svg.png')
                .setColor('#FF0000')
                .setTimestamp()
                .setFooter({ text: `Done in ${elapsedTime} seconds`});
            await interaction.editReply({embeds: [embedError]});
        }
    }
}