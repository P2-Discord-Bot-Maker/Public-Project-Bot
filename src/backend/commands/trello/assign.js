import Discord, {EmbedBuilder} from 'discord.js' // Importing Discord & EmbedBuilder from discord.js
import {assignMember, getAllMembers, resignMember, getCardsAssignedToMember, getCardsMemberIsNotOn, getEveryBoardName } from '../../trello.js' // Importing functions from trello.js
import { errorEmbed } from "../../utils.js"; // Importing error Embed from utils.js


// Discord command to assign or resign members on Trello to/from cards.
export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('ttask')
        .setDescription('Assign a member to a card on Trello Board')
        // Subcommand to assign members.
        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('assign')
                    .setDescription('Assign a member to a card on Trello')
                    .addStringOption(
                        option =>
                            option.setName('board')
                                .setDescription('The name of the board within your workspace')
                                .setAutocomplete(true)
                                .setRequired(true))
                    .addStringOption(
                        option =>
                            option.setName('member')
                                .setDescription('Name of the member you want to assign')
                                .setAutocomplete(true)
                                .setRequired(true))
                    .addStringOption(
                        option =>
                            option.setName('card')
                                .setDescription('Name of the card to assign to')
                                .setAutocomplete(true)
                                .setRequired(true))
        )
        // Subcommand to resign members.
        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('resign')
                    .setDescription('Resign a member from a card on Trello')
                    .addStringOption(
                        option =>
                            option.setName('board')
                                .setDescription('The name of the board within your workspace')
                                .setAutocomplete(true)
                                .setRequired(true))
                    .addStringOption(
                        option =>
                            option.setName('member')
                                .setDescription('Name of the member you want to resign')
                                .setAutocomplete(true)
                                .setRequired(true))
                    .addStringOption(
                        option =>
                            option.setName('card')
                                .setDescription('Name of the card to resign from')
                                .setAutocomplete(true)
                                .setRequired(true))
        ),
    // Autocompletion for the two different StringOptions.
    async autocomplete(interaction) {
        try {
            const focusedOption = interaction.options.getFocused(true);  // The active field on Discord.
            const command = interaction.options.getSubcommand(); // The subcommand that is being used.
            const guildId = interaction.guildId; // The guild ID
            const boardName = interaction.options.getString('board'); // Get the board name from the interaction
            const member = interaction.options.getString('member'); // Get the member from the interaction

            let choices, filtered; // Variables to store the choices and the filtered choices.

            // Autocompletion for members
            if (focusedOption.name === 'member') {
                // Get every member, and filter by what's typed on Discord.
                choices = await getAllMembers(boardName, guildId);                
            // Autocompletion for boards.
            } else if (focusedOption.name === 'board') {
                choices = await getEveryBoardName(guildId);            
            // Autocompletion for cards
            } else if (focusedOption.name === 'card') {                
                if (member !== null) {
                    if (command === 'assign') {
                        // Get every card that is not assigned to the member.
                        choices = await getCardsMemberIsNotOn(boardName, member, guildId);

                    } else if (command === 'resign') {
                        // Get every card that is assigned to the member.
                        choices = await getCardsAssignedToMember(boardName, member, guildId);
                    }
                } else {
                    await interaction.respond([{ name: 'Select a member first.', value: 'Error' }]);
                }
            }

            if (choices.length === 0) {
                throw new Error('No options found.');
            } else {
                // Filter the choices based on the input
                filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
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
        const command = interaction.options.getSubcommand(); // Get the subcommand
        const boardName = interaction.options.getString('board'); // Get the board
        const memberName = interaction.options.getString('member'); // Get the member
        const cardName = interaction.options.getString('card'); // Get the card
        const guildId = interaction.guildId; // Get the guild ID
        const startTime = Date.now(); // Get the start time

        /**
         * Function to respond with an embed
         * @param member - Name of the member
         * @param card - Name of the card
         * @param type - assigned / resigned
         * @returns {EmbedBuilder} - The embed to respond with
         */
        function respondEmbed(member, card, type, time) {
            const respondEmbed = new EmbedBuilder()
                .setColor(`#0099ff`)
                .setTitle('Trello Update')
                .setDescription(`Member ${type} to card`)
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Antu_trello.svg/1024px-Antu_trello.svg.png')
                .addFields(
                    { name: 'Board', value: boardName},
                    { name: 'Member', value: member, inline: true },
                    { name: 'Card', value: card, inline: true },
                )
                .setFooter({ text: `Done in ${time} seconds`});
            return respondEmbed;
        }
        
        await interaction.deferReply(); // Defer the reply
        let elapsedTime; // Variable to store the elapsed time

        // Assignment
        if (command === 'assign') {
            try {
                // Assign the member to the card.
                await assignMember(boardName, memberName, cardName, guildId);

                elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
                // Reply to discord.
                await interaction.editReply({ embeds: [respondEmbed(memberName, cardName, 'assigned', elapsedTime)] });
            // Error handling
            } catch (error) {
                console.error('Error in execute:', error);
                
                elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
                await interaction.editReply({ embeds: [errorEmbed(error.message, elapsedTime)] });
            }
        // Resigning
        } else if (command === 'resign') {
            try {
                // Resign the member from the card.
                await resignMember(boardName, memberName, cardName, guildId);

                elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

                // Reply to discord
                await interaction.editReply({ embeds: [respondEmbed(memberName, cardName, 'resigned', elapsedTime)] });

            // Error handling
            } catch (error) {
                console.error('Error in execute:', error.message);
                elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

                await interaction.editReply({ embeds: [errorEmbed(error.message, elapsedTime)] });
            }
        }
    }
}