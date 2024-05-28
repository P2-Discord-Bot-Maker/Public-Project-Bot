import Discord, {EmbedBuilder} from 'discord.js' // Import Discord and EmbedBuilder from discord.js
import { getAllList, deleteCard, deleteList, getAllCardsInList, getEveryBoardName } from '../../trello.js' // Import the functions from trello.js
import { errorEmbed } from '../../utils.js' // Import the errorEmbed function from utils.js

// Discord command to delete a list or a card in a list on Trello.
export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('tdelete')
        .setDescription('Delete card or list on Trello Board')
        // Subcommand to delete a list
        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('Delete a list in Trello')
                    .addStringOption(
                        option =>
                            option.setName('board')
                                .setDescription('The name of the board within your workspace')
                                .setAutocomplete(true)
                                .setRequired(true))
                    .addStringOption(
                        option =>
                            option.setName('list')
                            .setDescription('The list you want to delete')
                                .setAutocomplete(true)
                                .setRequired(true))

        )
        // Subcommand to delete a card in a list
        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('card')
                    .setDescription('Delete a card in Trello')
                    .addStringOption(
                        option =>
                            option.setName('board')
                                .setDescription('The name of the board within your workspace')
                                .setAutocomplete(true)
                                .setRequired(true))
                    // Name of the list
                    .addStringOption(
                        option =>
                            option.setName('list')
                                .setDescription('Name of the list where you want to delete a card')
                                .setAutocomplete(true)
                                .setRequired(true))
                    // Name of the card in the list
                    .addStringOption(
                        option =>
                            option.setName('card')
                                .setDescription('Name of the card you want to delete')
                                .setAutocomplete(true)
                                .setRequired(true))
        ),
    // Autocompleation for card and lists.
    async autocomplete(interaction) {
        try {
            const focusedOption = interaction.options.getFocused(true);  // The active field on Discord.
            const command = interaction.options.getSubcommand(); // The subcommand that is being used.
            const guildId = interaction.guildId; // The guild ID
            const boardName = interaction.options.getString('board'); // Get the board name
            const listName = interaction.options.getString('list'); // Get the list name

            let choices, filtered;

            // Autocompletion for lists
            if (command === 'list') {

                if (focusedOption.name === 'board') {
                    // get every board name
                    choices = await getEveryBoardName(guildId);
                } else if (focusedOption.name === 'list') {
                    // Get all lists on the board
                    choices = await getAllList(boardName, guildId);
                }                    

                // Autocompletion for cards
            } else if (command === 'card') {
                if (focusedOption.name === 'board') {
                    // Get every board name
                    choices = await getEveryBoardName(guildId);
                }
                else if (focusedOption.name === 'list') {
                    // Get all lists on the board
                    choices = await getAllList(boardName, guildId);
                } else if (focusedOption.name === 'card') {
                    // Get all cards in the list
                    choices = await getAllCardsInList(boardName, listName, guildId).then(choices => choices.map(card => card.name));
                }
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
            
            // Error handling.
        } catch (error) {
            console.error('Error in autocomplete: ' + error.message);
            await interaction.respond([{ name: 'Error', value: 'An error occurred while loading the options.'}]);
        }
    },
    // Execute the command
    async execute(interaction) {
        // Get the name of the card and list from the command.
        const card = interaction.options.getString('card');
        const list = interaction.options.getString('list');
        const boardName = interaction.options.getString('board');
        const guildId = interaction.guildId;

        // Determine the subCommand
        const command = interaction.options.getSubcommand()
        const startTime = Date.now();

        /**
         * Function to create an embed for the response.
         * @param type - list or card
         * @param card - card name
         * @param list - list name
         * @returns {EmbedBuilder} - The embed to respond with
         */
        function respondEmbed(type, card, list, time) {
            const respondEmbed = new EmbedBuilder(type, card, list)
                .setColor('#0099ff')
                .setTitle('Trello Update')
                .setDescription(`A ${type} has been deleted from Trello`)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Antu_trello.svg/1024px-Antu_trello.svg.png')
                .setFooter({ text: `Done in ${time} seconds`});
            if (type && list && !card) {
                respondEmbed.addFields(
                    { name: 'List', value: list, inline: true }
                );
            } else if (type && list && card) {
                respondEmbed.addFields(
                    { name: 'Card', value: card, inline: true },
                    { name: 'List', value: list, inline: true }
                );

            }
            return respondEmbed;
        }

        await interaction.deferReply(); // Defer the reply
        let elapsedTime; // Variable to store the elapsed time
        if (command === 'list') {
            try {
                // Delete the list
                await deleteList(boardName, list, guildId);
                elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

                // Send the embed to Discord
                await interaction.editReply({ embeds: [respondEmbed('List', null, list, elapsedTime)] });
            } catch (error) {
                elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
                await interaction.editReply({ embeds: [errorEmbed(error.message, elapsedTime)]});
            }
        } else if (command === 'card') {
            try {
                // Delete the card in the list.
                await deleteCard(boardName, list, card, guildId);
                elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

                // Send the embed to Discord
                await interaction.editReply({ embeds: [respondEmbed('Card', card, list, elapsedTime)] });
            // Error handling
            } catch (error) {
                console.error('Error in execute:', error);
                elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
                await interaction.editReply({ embeds: [errorEmbed(error.message, elapsedTime)]});
            }
        }
    }
}