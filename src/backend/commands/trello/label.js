import Discord, {EmbedBuilder } from 'discord.js' // Importing Discord & EmbedBuilder from discord.js
import { getAllCardsInList, getEveryBoardName, getLabelsInBoard, assignLabel, getAllList } from '../../trello.js' // Importing functions from trello.js
import { errorEmbed } from "../../utils.js"; // Importing error Embed from utils.js


// Discord command to add labels to cards
export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('tlabel')
        .setDescription('Add a label to a card on Trello')
        .addStringOption(
            option =>
                option.setName('board')
                    .setDescription('The name of the board within your workspace')
                    .setAutocomplete(true)
                    .setRequired(true))
        .addStringOption(
            option =>
                option.setName('list')
                    .setDescription('Name of the list search for a card within')
                    .setAutocomplete(true)
                    .setRequired(true))
        .addStringOption(
            option =>
                option.setName('card')
                    .setDescription('Name of the card to add a label fo')
                    .setAutocomplete(true)
                    .setRequired(true))
        .addStringOption(
            option =>
                option.setName('label')
                    .setDescription('Name of the label to add')
                    .setAutocomplete(true)
                    .setRequired(true)),

    // Autocompletion for the command
    async autocomplete(interaction) {
        try {
            const focusedOption = interaction.options.getFocused(true); // The active field on Discord.
            const guildId = interaction.guildId;                        // Get guild ID
            const boardName = interaction.options.getString('board');   // Get board
            const listName = interaction.options.getString('list');     // Get list
            let choices, filtered; 

            // Autocompletion for boards
            if (focusedOption.name === 'board') {
                // Get every board
                choices = await getEveryBoardName(guildId);
            // Autocompletion for lists
            } else if (focusedOption.name === 'list') {
                // Get every list
                choices = await getAllList(boardName, guildId);
            // Autocompletion for cards
            } else if (focusedOption.name === 'card') {
                // Get every card on list, map it to its name
                choices = await getAllCardsInList(boardName, listName, guildId).then(choices => choices.map(card => card.name));
                // Autocompletion for labels
            } else if (focusedOption.name === 'label') {
                // Get every label on board & remove empty labels
                choices = await getLabelsInBoard(boardName, guildId)
                .then(labels => labels.map(label => label.name))
                .then(labels => labels.filter(label => label !== ''));
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
            console.error('Error in autocomplete: ', error);
            // Respond with an error message
            await interaction.respond([{ name: 'Error', value: 'An error occurred while loading the options.' }]);
        }
    },

    // Execution of the command.
    async execute(interaction) {
        const boardName = interaction.options.getString('board'); // Get the board
        const listName = interaction.options.getString('list'); // Get the list
        const cardName = interaction.options.getString('card'); // Get the card
        const labelName = interaction.options.getString('label'); // Get the label
        const guildId = interaction.guildId; // Get the guild ID
        const startTime = Date.now(); // Start time for the command

        /**
         * Function to respond with an embed
         * @param member - Name of the member
         * @param card - Name of the card
         * @param type - assigned / resigned
         * @returns {EmbedBuilder} - The embed to respond with
         */
        function respondEmbed(boardName, listName, cardName, labelName, time) {
            const respondEmbed = new EmbedBuilder()
                .setColor(`#0099ff`)
                .setTitle('Trello Update')
                .setDescription(`Added label to card`)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Antu_trello.svg/1024px-Antu_trello.svg.png')
                .addFields(
                    { name: 'Board', value: boardName},
                    { name: 'List', value: listName, inline: true },
                    { name: 'Label', value: labelName, inline: true },
                    { name: 'Card', value: cardName}
                )
                .setFooter({ text: `Done in ${time} seconds`});
            return respondEmbed;
        }

        await interaction.deferReply();
        let elapsedTime; // Variable to store the elapsed time
        // Adding label to card
        try {
            // Assign the member to the card.
            await assignLabel(boardName, listName, cardName, labelName, guildId);
            elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

            // Reply to discord.
            await interaction.editReply({ embeds: [respondEmbed(boardName, listName, cardName, labelName, elapsedTime)] });
        
            // Error handling
        } catch (error) {
            console.error('Error in execute:', error);
            elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
            await interaction.editReply({ embeds: [errorEmbed(error.message, elapsedTime)] });
        }        
    }
}