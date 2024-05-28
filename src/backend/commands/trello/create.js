import Discord, { EmbedBuilder } from 'discord.js'; // Importing Discord & embedBuilder from discord.js
import {createCard, createList, getAllList, createLabel, getEveryBoardName } from '../../trello.js'; // Importing functions from trello.js
import {convertToTrelloColor, errorEmbed, trelloColors} from "../../utils.js"; // Importing error Embed from utils.js

// Discord command to create cards, lists, and labels on Trello.
export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('tcreate')
        .setDescription('Create on Trello Board')
        // Subcommands to create a card
        .addSubcommand(
            subcommand =>
            subcommand
            .setName('card')
            .setDescription('Create a card on Trello Board')
            .addStringOption(
                option =>
                    option.setName('name')
                        .setDescription('Name of the thing you want to create')
                        .setRequired(true))
                .addStringOption(
                option =>
                    option.setName('board')
                        .setDescription('The name of the board within your workspace')
                        .setAutocomplete(true)
                        .setRequired(true))
            .addStringOption(
                option =>
                option.setName('list')
                    .setDescription('List of the card you want to create')
                    .setAutocomplete(true)
                    .setRequired(true))
        )
        // Subcommand to create a list
        .addSubcommand
        (subcommand =>
            subcommand.setName('list')
            .setDescription('Create a list on Trello Board')
            .addStringOption(
                option =>
                    option.setName('name')
                        .setDescription('Name of the thing you want to create')
                        .setRequired(true))
            .addStringOption(
                option =>
                    option.setName('board')
                        .setDescription('The name of the board within your workspace')
                        .setAutocomplete(true)
                        .setRequired(true))
        )
        // Subcommand to create a label
        .addSubcommand
        (subcommand =>
            subcommand.setName('label')
            .setDescription('Create a label on Trello Board')
            .addStringOption(
                option =>
                    option.setName('name')
                        .setDescription('Name of the thing you want to create')
                        .setRequired(true))
            .addStringOption(
                option =>
                    option.setName('color')
                        .setDescription('Color of the label you want to create')
                        .setAutocomplete(true)
                        .setRequired(true))
            .addStringOption(
                option =>
                    option.setName('board')
                    .setDescription('The name of the board within your workspace')
                    .setAutocomplete(true)
                    .setRequired(true))
        )
        ,
        // Autocompletion for lists
        async autocomplete(interaction) {
            try {
                const subCommand = interaction.options.getSubcommand(); // Subcommand used
                const focusedOption = interaction.options.getFocused(true); 
                const boardName = interaction.options.getString('board'); // The active field on Discord.
                const guildId = interaction.guildId; // Get the guild ID
                let choices, filtered;

                // Create card
                if (subCommand === 'card') {
                    // Autocompletion for boards
                    if (focusedOption.name === 'board') {
                        choices = await getEveryBoardName(guildId);
                    // Autocompletion for lists
                    } else if (focusedOption.name = 'list') { //
                        choices = await getAllList(boardName, guildId);
                    } 
                    // Create list
                    } else if (subCommand === 'list') {
                        // Autocompletion for boards
                        if (focusedOption.name === 'board') {
                            choices = await getEveryBoardName(guildId);
                        }
                    // Create label
                    } else if (subCommand === 'label') {
                        // Autocompletion for boards
                        if (focusedOption.name === 'board') {
                            choices = await getEveryBoardName(guildId);

                        // Autocompletion for color
                    } else if (focusedOption.name = 'color') {
                        choices = trelloColors();
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
                    
            // Error handling for autocompletion
            } catch (error) {
                console.error('Error in autocomplete:', error);
                // Respond with an error message
                await interaction.respond([{ name: 'Error', value: 'An error occurred while loading the options.' }]);
            }
        },


        




    // Execute the command
    async execute(interaction){
        const name = interaction.options.getString('name'); // Get the name of the thing to create
        const list = interaction.options.getString('list'); // Get the list of the thing to create
        const color = interaction.options.getString('color'); // Get the color of the thing to create
        const boardName = interaction.options.getString('board'); // Get the board name
        const guildId = interaction.guildId; // Get the guild ID
        const command = interaction.options.getSubcommand(); // Get the subcommand
        const startTime = Date.now(); // Start time of the command

        /**
         * Function to respond with an embed
         * @param type - The type of thing created
         * @param card - The name of the card
         * @param list - The name of the list
         * @param labelName - The name of the label
         * @param labelColor - The color of the label
         * @returns {EmbedBuilder} - The embed to respond with
         */
        function respondEmbed(type, card, list, labelName, labelColor, labelHex = '#0099ff', time) {
            const respondEmbed = new EmbedBuilder()
                .setColor(labelHex)
                .setTitle('Trello Update')
                .setDescription(`New ${type} created`)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Antu_trello.svg/1024px-Antu_trello.svg.png')
                .setFooter({ text: `Done in ${time} seconds`});
            if (card && list && !labelName && !labelColor) { // If a card is created
                respondEmbed.addFields(
                    { name: 'Card:', value: card, inline: true },
                    { name: 'List:', value: list, inline: true }
                );
            } else if (list && !card && !labelName && !labelColor) { // If a list is created
                respondEmbed.addFields(
                    { name: 'List:', value: list, inline: true }
                );

            } else if (labelName && labelColor && !card && !list) { // If a label is created
                respondEmbed.addFields(
                    { name: 'Label:', value: labelName, inline: true },
                    { name: 'Color:', value: labelColor, inline: true }
                );

            }
            return respondEmbed;
        }

        await interaction.deferReply(); // Defer the reply
        let elapsedTime; // Variable to store the elapsed time
        
        try {
            switch (command) {
                case 'card':
                    // Create a new card
                    const newCard = await createCard(boardName, list, name, guildId);

                    elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

                    // Respond with an embed
                    await interaction.editReply({embeds: [respondEmbed('card', newCard.name, list, undefined, undefined, undefined, elapsedTime)]});
                    break;
                case 'list':
                    // Create a new list
                    const newList = await createList(boardName, name, guildId);
                    
                    elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

                    // Respond with an embed
                    await interaction.editReply({embeds: [respondEmbed('list', undefined, newList.name, undefined, undefined, undefined, elapsedTime)]});
                    break;
                case 'label':
                    // Create a new label
                    const newLabel = await createLabel(boardName, name, color, guildId);
                    const colorHex = convertToTrelloColor(color).hex;
                    
                    elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

                    // Respond with an embed
                    await interaction.editReply({embeds: [respondEmbed('label', undefined, undefined, newLabel.name, color, colorHex, elapsedTime)]});
                    break;
                default:
                    // If the subcommand is not recognized, send an error message
                    await interaction.editReply('Sorry, but I do not recognize the type of thing you want to create.');
                    break;
            }
        // Error handling
        } catch (error) {
            console.error('Error in execute:', error);
            
            elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
            await interaction.editReply({embeds: [errorEmbed(error.message, elapsedTime)]});
        }
    }
}
