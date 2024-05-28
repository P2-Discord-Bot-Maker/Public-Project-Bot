import Discord, { EmbedBuilder } from 'discord.js'
import { getAllCardsInList, getAllList, getEveryBoardName } from '../../trello.js'
import { convertToTrelloColor, errorEmbed } from '../../utils.js'

export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('tlistcards')
        .setDescription('List trello cards')
        // String option for the list
        .addStringOption(
            option =>
                option.setName('board')
                    .setDescription('The name of the board within your workspace')
                    .setRequired(true)
                    .setAutocomplete(true))
        .addStringOption(
            option =>
                option.setName('list')
                    .setDescription('List of the cards you want to list')
                    .setRequired(true)
                    .setAutocomplete(true)
        ),
    // Autocompletion for the list
    async autocomplete(interaction) {
        try {
            const focusedOption = interaction.options.getFocused(true); // Get the active field on Discord
            const guildId = interaction.guildId; // Get the guild ID
            const boardName = interaction.options.getString('board');

            let choices, filtered;

            if (focusedOption.name === 'board') {
                choices = await getEveryBoardName(guildId);
            } else if (focusedOption.name === 'list') {
                choices = await getAllList(boardName, guildId);
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

        // Error handling for autocomplete
        } catch (error) {
            console.error('Error in autocomplete:', error);
            // Respond with an error message
            await interaction.respond([{ name: 'Error', value: 'An error occurred while loading the options.' }]);
        }
    },
    // Execute the command
    async execute(interaction){
        const embeds = [];
        const startTime = Date.now(); // Start time for the command
        let elapsedTime;

        await interaction.deferReply(); // Defer the reply

        try {
            const board = interaction.options.getString('board'); // Get the board name
            const list = interaction.options.getString('list'); // Get the list name
            const guildId = interaction.guildId; // Get the guild ID

            const allCards = await getAllCardsInList(board, list, guildId); // Get all cards in the list

            // Create an embed for each card
            for (const card of allCards) {
                let desc = "No description";
                if (card.desc !== undefined && card.desc.length > 0){
                    desc = card.desc;
                }
                // Set the color of the embed to the color of the label
                let color = 0x0099FF;
                let labelText = "";
                if (card.labels === undefined){
                    labelText = "No labels";
                }
                else if (card.labels.length > 0){
            
                    // The color of the first label on the card
                    const cardColor = card.labels[0].color;

                    // Get all colors
                    const colors = convertToTrelloColor();

                    // Get the color matching the cardColor, then get its hex
                    color = (convertToTrelloColor(Object.keys(colors)
                        .filter(key => colors[key].name === cardColor))).hex;
                        
                    // Concatenate the label name
                    for (const label of card.labels){
                        labelText += label.name + " ";
                    }
                }
                
                // No label text
                else {
                    labelText = "No labels";
                }

                elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

                // Create the embed
                const exampleEmbed = new EmbedBuilder()
                    .setColor(color)
                    .setTitle(card.name)
                    .setDescription(desc)
                    .setTimestamp()
                    .setFooter({ text: `${labelText}, Done in ${elapsedTime} seconds` });
                embeds.push(exampleEmbed);
            }

            if (!Array.isArray(embeds)) {
                throw new Error('embeds must be an array');
            }
            
            // Split the embeds into chunks of 10
            const chunks = [];
            for (let i = 0; i < embeds.length; i += 10) {
                chunks.push(embeds.slice(i, i + 10));
            }

            // Send the first chunk in a reply
            if (chunks.length > 0) {
                await interaction.editReply({ embeds: chunks[0] });
            
                // Send the remaining chunks in follow-ups
                for (let i = 1; i < chunks.length; i++) {
                    await interaction.followUp({ embeds: chunks[i] });
                }
            }
            // Error handling
        } catch (error) {
            console.error('Error in execute:', error);

            elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
            await interaction.editReply({embeds: [errorEmbed(error.message, elapsedTime)]});
        }
    }
}