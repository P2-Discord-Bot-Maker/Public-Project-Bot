import Discord, {EmbedBuilder} from 'discord.js';
import { getAllList, getAllCardsInList, moveCard, getEveryBoardName } from '../../trello.js';
import {errorEmbed} from "../../utils.js";

// Discord command to move a card to another list on Trello
export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('tmove')
        .setDescription('Move a card to another list')
        // String option for the list to move from
        .addStringOption(
            option =>
                option.setName('board')
                .setDescription('The name of the board within your workspace')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(
            option =>
                option.setName('from')
                .setDescription('Name of the list you want to move from')
                .setRequired(true)
                .setAutocomplete(true)
        )
        // String option for the card to move
        .addStringOption(
            option =>
                option.setName('card')
                .setDescription('Name of the card you want to move')
                .setRequired(true)
                .setAutocomplete(true)
        )
        // String option for the list to move to
        .addStringOption(
            option =>
                option.setName('to')
                .setDescription('Name of the list you want to move to')
                .setRequired(true)
                .setAutocomplete(true)
        ),
        // Autocompletion for the three different StringOptions.
        async autocomplete(interaction) {
            try {
                // Get the active field on Discord
                const focusedOption = interaction.options.getFocused(true);
                const boardName = interaction.options.getString('board');
                const guildId = interaction.guildId; // Get the guild ID
                const fromList = interaction.options.getString('from');

                let choices, filtered; // Initialize the variables

                // Check which field is active and get the options for that field
                if (focusedOption.name === 'board') {
                    // Get all boards
                    choices = await getEveryBoardName(guildId);
                } else if (focusedOption.name === 'from') {
                    // Get all lists on the board
                    choices = await getAllList(boardName, guildId);
                } else if (focusedOption.name === 'card') {
                    // Get all cards in the fromList, map each card to its name
                    choices = await getAllCardsInList(boardName, fromList, guildId)
                    .then(cards => cards.map(card => card.name));
                } else if (focusedOption.name === 'to') {
                    // Get all lists in the board, exclude the fromList
                    choices = await getAllList(boardName, guildId)
                    .then(lists => lists.filter(list => list !== fromList));
                }

                if (choices.length === 0) {
                    throw new Error('No options found.');
                } else {
                    // Filter the choices based on the input
                    filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
                    // If there are more than 25 options than cut it down it 25 (the max).
                    if (filtered.length > 25) {
                        filtered = filtered.slice(0, 25);
                    }
                    
                    // send the options to Discord
                    await interaction.respond(
                        filtered.map(choice => ({ name: choice, value: choice })),
                    );
                }

            // Error handling for autocompletion
            } catch (error) {
                console.error('Error in autocomplete:', error);
                await interaction.respond([{ name: 'Error', value: 'An error occurred while loading the options.' }]);
            }

        },
    // Execution of the command
    async execute(interaction) {
        const board = interaction.options.getString('board'); // Get the board name
        const fromList = interaction.options.getString('from'); // Get the list to move from
        const card = interaction.options.getString('card'); // Get the card to move
        const toList = interaction.options.getString('to'); // Get the list to move to
        const guildId = interaction.guildId; // Get the guild ID
        const startTime = Date.now(); // Start time for the command

        /**
         * Respond with an embed message
         * @param fromList - Name of the list to move from
         * @param card - Name of the card to move
         * @param toList - Name of the list to move to
         * @returns {EmbedBuilder} - The embed message
         */
        function respondEmbed(fromList, card, toList, time) {
            const respondEmbed = new EmbedBuilder()
                .setColor(`#0099ff`)
                .setTitle('Trello Update')
                .setDescription(`The card "${card}" has been moved`)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Antu_trello.svg/1024px-Antu_trello.svg.png')
                .addFields(
                    { name: 'Card', value: card, inline: true },
                    { name: 'From', value: fromList, inline: true },
                    { name: 'To', value: toList, inline: true },
                )
                .setFooter({ text: `Done in ${time} seconds`});
            return respondEmbed;
        }

        await interaction.deferReply(); // Defer the reply
        let elapsedTime;

        try {
            // Move the card
            await moveCard(board, fromList, card, toList, guildId);
            elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

            // Respond with an embed message
            await interaction.editReply({ embeds: [respondEmbed(fromList, card, toList, elapsedTime)] });

        // Error handling
        } catch (error) {
            console.error('Error in execute:', error);
            elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
            await interaction.editReply({ embeds: [errorEmbed(error.message, elapsedTime)]});
        }
    }

}