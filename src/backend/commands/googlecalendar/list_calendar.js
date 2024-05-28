import Discord, {EmbedBuilder} from 'discord.js'
import {listEvents} from '../../calendar.js';

// Ciscord command to list upcoming events from a calendar 
export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('clist')
        .setDescription('Lists upcoming events from the calendar')
        // Add a subcommand to list events
        .addSubcommand(
            subcommand =>
            subcommand
                .setName('event')
                    .setDescription('Lists upcoming events')
                    .addStringOption(
                        option =>
                        option.setName('amount')
                        .setDescription('Amount of events you want to list')
                        .setRequired(true))
        ),
    /**
     * @description Executes the list calendar command.
     * @param {Discord.CommandInteraction} interaction - The interaction object representing the command interaction.
     * @returns {Promise<void>} A promise that resolves when the command execution is complete.
     */
    async execute(interaction){
        // Get the event details from the interaction (user inputs)
        const amount = interaction.options.getString('amount');
        const guildId = interaction.guildId;
        const startTime = new Date().now;
        let elapsedTime;
        await interaction.deferReply(); // Defer the reply
        
        try {
            // Get the list of events
            let eventList = await listEvents(amount, guildId);

            // Create an array to store all embeds
            let embeds = [];
           
            // Loop through the list of events
            eventList.forEach(element => {
                // To convert date format to match
                let eventDate = new Date(element.start.dateTime || element.start.date);

                // Create fields for the embed
                let fields = [
                    {name: 'Description', value: element.description || 'No description provided'},
                    {name: 'Date', value: eventDate.getFullYear() + '-' + (eventDate.getMonth() + 1).toString().padStart(2, '0') + '-' + eventDate.getDate().toString().padStart(2, '0'), inline: true},
                ];

                // Check if the event is an full-day event or not
                if (element.start.dateTime) {
                   fields.push( {name: 'Time', value: eventDate.getHours().toString().padStart(2, '0') + ':' + eventDate.getMinutes().toString().padStart(2, '0'), inline: true},);
                } else {
                    fields.push({name: 'Time', value: 'Full-day event', inline: true})
                }

                elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

                // Create embed message. Using .toString().padStart(2, '0') to ensure that the date and time are always two digits.
                const embedList = new EmbedBuilder()
                    .setTitle(element.summary)
                    .setDescription('Calendar event')
                    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/1024px-Google_Calendar_icon_%282020%29.svg.png')
                    .setURL(element.htmlLink)
                    .setColor('#800080') // Set color to purple
                    .setFields(fields)
                    .setFooter({ text: `Done in ${elapsedTime} seconds`});
                embeds.push(embedList);               
            });
        // Split the embeds into chunks of 10 (10 embeds is max per message, discord limitation)
        const chunks = [];
        for (let i = 0; i < embeds.length; i += 10) {
            chunks.push(embeds.slice(i, i + 10));
        }
        elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
        // Send the first chunk in a reply
        await interaction.editReply({ embeds: chunks[0] });

        // Send the remaining chunks in follow-ups
        for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp({ embeds: chunks[i] });
        }
        } catch (error) {
            const embedError = new EmbedBuilder()
                .setTitle('Error listing event(s)')
                .setDescription('Error: ' + error.message)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/1024px-Google_Calendar_icon_%282020%29.svg.png')
                .setColor('#FF0000')
                .setTimestamp()
                .setFooter({ text: `Done in ${elapsedTime} seconds`});
            await interaction.editReply({embeds: [embedError]});
        }
    }
}