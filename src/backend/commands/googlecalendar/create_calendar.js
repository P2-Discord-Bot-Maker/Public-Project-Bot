/**
 * @file Create Calendar Command
 * @description This file contains the implementation of the create calendar command for creating events on the P2 calendar.
 */

import Discord, {EmbedBuilder} from 'discord.js'
import {createEvent} from '../../calendar.js'

/**
 * @constant {Object} command - The create calendar command object.
 * @property {Discord.SlashCommandBuilder} data - The slash command builder object for the create calendar command.
 * @property {Function} execute - The function that executes the create calendar command.
 */
export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('ccreate')
        .setDescription('Create an event on P2 calendar')
        .addSubcommand(
            subcommand =>
            subcommand
                .setName('event')
                .setDescription('Create an event')
                .addStringOption(
                    option =>
                    option.setName('title')
                    .setDescription('Title of the Event you want to create')
                    .setRequired(true))
                .addStringOption(
                    option =>
                    option.setName('description')
                    .setDescription('Descripe the event you want to create')
                    .setRequired(false))
                .addStringOption(
                    option =>
                    option.setName('year')
                    .setDescription('Year of the event you want to create, default is current year')
                    .setRequired(false))
                .addStringOption(
                    option =>
                    option.setName('month')
                    .setDescription('Month of the event you want to create, default is current month')
                    .setRequired(false))
                .addStringOption(
                    option =>
                    option.setName('day')
                    .setDescription('Day of the event you want to create, default is current day')
                    .setRequired(false))
                .addStringOption(
                    option =>
                    option.setName('hour_of_event')
                    .setDescription('The hour of the day the event will take place, default is current hour')
                    .setRequired(false))
                .addStringOption(
                    option =>
                    option.setName('minute_of_event')
                    .setDescription('The minute of the hour the event will take place, default is 0')
                    .setRequired(false))
                .addStringOption(
                    option =>
                    option.setName('event_duration_hour')
                    .setDescription('The duration of the event in hours, default is 1 hour')
                    .setRequired(false))
                .addStringOption(
                    option =>
                    option.setName('event_duration_minutes')
                    .setDescription('The duration of the event in minutes, default is 0 minutes')
                    .setRequired(false))
                .addBooleanOption(
                    option =>
                    option.setName('full_day')
                    .setDescription('The event is a full day event')
                    .setRequired(false)),
        ),
    /**
     * @description Executes the create calendar command.
     * @param {Discord.CommandInteraction} interaction - The interaction object representing the command interaction.
     * @returns {Promise<void>} A promise that resolves when the command execution is complete.
     */
    async execute(interaction){
        // Get the event details from the interaction (user inputs)
        const title = interaction.options.getString('title');
        const desc = interaction.options.getString('description');
        const yyyy = interaction.options.getString('year');
        const mm = interaction.options.getString('month');
        const dd = interaction.options.getString('day');
        const hours = interaction.options.getString('hour_of_event');
        const minutes = interaction.options.getString('minute_of_event');
        const durationHours = interaction.options.getString('event_duration_hour');
        const durationMinutes = interaction.options.getString('event_duration_minutes');
        const fullDay = interaction.options.getBoolean('full_day');
        const guildId = interaction.guildId; // Get the guild ID
        const startTime = Date.now(); // Start time for the command
        let elapsedTime;
        await interaction.deferReply(); // Defer the reply

        try {
            const newEvent = await createEvent(title, desc, yyyy, mm, dd, hours, minutes, durationHours, durationMinutes, fullDay, guildId);
            // Create an array of fields to display in the embed message
            let fields = [
                {name: 'Title', value: newEvent.title},
                {name: 'Description', value: newEvent.desc || 'No description provided'},
                {name: 'Date', value: newEvent.yyyy + '-' + newEvent.mm.toString().padStart(2, '0') + '-' + newEvent.dd.toString().padStart(2, '0'), inline: true},
            ];
            // If the event is a full-day event, add a field for the time
            if (fullDay) {
                fields.push({name: 'Time', value: 'Full-day event', inline: true})
            } else{
                fields.push({name: 'Time', value: newEvent.hours.toString().padStart(2, '0') + ':' + newEvent.minutes.toString().padStart(2, '0'), inline: true}),
                fields.push({name: 'Duration', value: newEvent.durationHour + ' hour(s) and ' + newEvent.durationMinutes + ' minute(s)'})
            }
            elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

            // Create embed message. Using .toString().padStart(2, '0') to ensure that the date and time are always two digits.
            const embedCreate = new EmbedBuilder()
            .setTitle('Calendar event created')
            .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/1024px-Google_Calendar_icon_%282020%29.svg.png')
            .setColor('#00FF00')
            .setFields(fields)
            .setFooter({ text: `Done in ${elapsedTime} seconds`});
            await interaction.editReply({embeds: [embedCreate]});
        } catch (error) {
            const embedError = new EmbedBuilder()
                .setTitle('Error creating event')
                .setDescription('Error: ' + error.message)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/1024px-Google_Calendar_icon_%282020%29.svg.png')
                .setColor('#FF0000')
                .setTimestamp()
                .setFooter({ text: `Done in ${elapsedTime} seconds`});
            await interaction.editReply({embeds: [embedError]});
        }
    }
}