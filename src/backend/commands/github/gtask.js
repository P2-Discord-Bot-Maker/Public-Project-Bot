import Discord, { EmbedBuilder } from 'discord.js'; // Importing Discord & embedBuilder from discord.js
import {assignMemberToPullRequest, resignMemberToPullRequest, getAllOwners, getAllRepos, getAllPullRequests, getAllMembers, validation} from '../../github.js'; // Importing functions from github.js
import {errorEmbed} from "../../utils.js"; // Importing error Embed from utils.js

export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('gtask')
        .setDescription('Assign a member to a pullrequest on Github')
        // Subcommand to assign members.
        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('assign')
                    .setDescription('Assign a member to a pullrequest on Github')
                    .addStringOption(
                        option =>
                        option.setName('owner')
                        .setDescription('The owner of the repoository')
                        .setAutocomplete(true)
                        .setRequired(true))
                    .addStringOption(
                        option =>
                        option.setName('repo')
                        .setDescription('The name of the repository')
                        .setAutocomplete(true)
                        .setRequired(true))
                    .addStringOption(
                        option =>
                        option.setName('title')
                        .setDescription('The title of the pull request')
                        .setAutocomplete(true)
                        .setRequired(true))
                    .addStringOption(
                        option =>
                        option.setName('type')
                        .setDescription('Set the user as a reviewer or assignee')
                        .setAutocomplete(true)
                        .setRequired(true))
                    .addStringOption(
                        option =>
                        option.setName('member')
                        .setDescription('The user you want to assign')
                        .setAutocomplete(true)
                        .setRequired(true))
        )
        // Subcommand to resign members.
        .addSubcommand(
            subcommand =>
                subcommand
                .setName('resign')
                .setDescription('Resign a member to a pullrequest on Github')
                .addStringOption(
                    option =>
                    option.setName('owner')
                    .setDescription('The owner of the repoository')
                    .setAutocomplete(true)
                    .setRequired(true))
                .addStringOption(
                    option =>
                    option.setName('repo')
                    .setDescription('The name of the repository')
                    .setAutocomplete(true)
                    .setRequired(true))
                .addStringOption(
                    option =>
                    option.setName('title')
                    .setDescription('The title of the pull request')
                    .setAutocomplete(true)
                    .setRequired(true))
                .addStringOption(
                    option =>
                    option.setName('type')
                    .setDescription('Set the user as a reviewer or assignee')
                    .setAutocomplete(true)
                    .setRequired(true))
                .addStringOption(
                    option =>
                    option.setName('member')
                    .setDescription('The user you want to resign')
                    .setAutocomplete(true)
                    .setRequired(true))
        ),
    // Autocompletion for the two different StringOptions.
    async autocomplete(interaction) {
        try {
            const focusedOption = interaction.options.getFocused(true);  // The active field on Discord.
            const command = interaction.options.getSubcommand(); // The subcommand that is being used.
            const guildId = interaction.guildId; // The guild ID of the interaction.
            const owner = interaction.options.getString('owner'); // Get the owner (inserted by the user)
            const repo = interaction.options.getString('repo'); // Get the repo (inserted by the user)
            const title = interaction.options.getString('title'); // Get the title (inserted by the user)
            const type = interaction.options.getString('type'); // Get the type (inserted by the user)
            let choices, filtered;

            // Autocompletion for owners
            if (focusedOption.name === 'owner') {
                // Get every owner, and filter by what's typed on Github.
                choices = await getAllOwners(guildId);
            // Autocompletion for repos
            } else if (focusedOption.name === 'repo') {
                // Get every repo, and filter by what's typed on Discord.
                choices = await getAllRepos(owner, guildId);
            // Autocompletion for titles
            } else if (focusedOption.name === 'title') {
                // Get every pull request, and filter by what's typed on Discord.
                choices = await getAllPullRequests(owner, repo, guildId).then(choices => choices.map(pr => pr.title));
            // Autocompletion for type
            } else if (focusedOption.name === 'type') {
                // Get every type, and filter by what's typed on Discord.
                choices = ['Assignee', 'Reviewer'];
            // Autocompletion for members
            } else if (focusedOption.name === 'member') {
                // Get every member, and filter by what's typed on Discord.
                choices = await getAllMembers(owner, repo, title, guildId, type, command);
            }

            if (choices.length === 0) {
                throw new Error('No options found.');
            } else {
                filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
                if (filtered.length > 25) {
                    filtered = filtered.slice(0, 25);
                }

                // Respond to Discord with the filtered choices
                await interaction.respond(
                    filtered.map(choice => ({ name: choice, value: choice })),
                );
            }

            // Error handling for autocompletion
        } catch (error) {
            console.error('Error in autocomplete: ', error.message);
            // Respond with an error message
            await interaction.respond([{ name: `${error}`, value: 'An error occured' }]);
        }
    },

    async execute(interaction){
        const startTime = Date.now(); // Get the current time
        const owner = interaction.options.getString('owner'); // Get the name owner of the repository
        const repo = interaction.options.getString('repo'); // Get the name of the repository
        const title = interaction.options.getString('title'); // Get the title of the pull request
        const member = interaction.options.getString('member'); // Get the member to assign or resign
        const type = interaction.options.getString('type'); // Get the type (assignee or reviewer)
        const command = interaction.options.getSubcommand(); // Get the subcommand
        const guildId = interaction.guildId;

        /**
         * Function to respond with an embed
         * @returns {EmbedBuilder} - The embed to respond with
         */
        function respondEmbed(time) {
            const respondEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Github Update')
                .setDescription(`${member} ${command}ed to pull request`)
                .setThumbnail('https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png')
                .setFooter({ text: `Done in ${time} seconds`});
            if (owner && repo && title && member) {
                respondEmbed.addFields(
                    { name: 'Owner:', value: owner, inline: true },
                    { name: 'Repo:', value: repo, inline: true },
                    { name: 'Title:', value: title, inline: true },
                    { name: 'Member:', value: member, inline: true },
                    { name: 'Type:', value: type, inline: true}
                );
            }
            return respondEmbed;
        }
        
        try {
            // Send a 'bot is thinking...' message while working on handling the command
            await interaction.deferReply();
            // Validate the inputs
            await validation(guildId, owner, repo, title, type, member, command);

            let elapsedTime;
            switch (command) {
                case 'assign':;
                    // Assign member to pull request
                    await assignMemberToPullRequest(owner, repo, title, member, guildId, type);
                    elapsedTime = ((Date.now() - startTime)/1000).toFixed(2);
                    // Update the reply with an embed
                    await interaction.editReply({embeds: [respondEmbed(elapsedTime)]});
                    break;
                case 'resign': 
                    // Remove member from pull request
                    await resignMemberToPullRequest(owner, repo, title, member, guildId, type);
                    elapsedTime = ((Date.now() - startTime)/1000).toFixed(2);
                    
                    // Update the reply with an embed
                    await interaction.editReply({embeds: [respondEmbed(elapsedTime)]});
                    break;
                    
                default:
                    // If the subcommand is not recognized, send an error message
                    await interaction.editReply('Sorry, but I do not recognize the type of thing you want to create.');
                    break;
            }
            
        // Error handling
        } catch (error) {
            console.log('error ' + error.message);
            elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

            await interaction.editReply({embeds: [errorEmbed(error.message, elapsedTime)]});
        }
    }
}