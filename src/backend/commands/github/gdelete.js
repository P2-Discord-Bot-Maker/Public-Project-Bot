import Discord, { EmbedBuilder } from 'discord.js'; // Importing Discord & embedBuilder from discord.js
import {closePullRequest, deleteBranch, getAllOwners, getAllRepos, getAllBranches, getAllPullRequests, validation} from '../../github.js'; // Importing functions from github.js
import {errorEmbed} from "../../utils.js"; // Importing error Embed from utils.js

// Discord command to delete pullrequest and branch on Github.


export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('gdelete')
        .setDescription('Delete on Github')
        // Subcommands to close a pullrequest
        .addSubcommand(
            subcommand =>
            subcommand
            .setName('pullrequest')
            .setDescription('Close a pull request on Github')
            .addStringOption(
                option =>
                option.setName('owner')
                .setDescription('The owner of the repository')
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
        )
        // Subcommand to delete a branch
        .addSubcommand
        (subcommand =>
            subcommand.setName('branch')
            .setDescription('Delete a branch on Github')
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
                option.setName('branch-title')
                .setDescription('Name of the branch')
                .setAutocomplete(true)
                .setRequired(true))
        )
        ,

        async autocomplete(interaction) {
            try {
    
                const focusedOption = interaction.options.getFocused(true);  // The active field on Github.
                const command = interaction.options.getSubcommand(); // The subcommand that is being used.
                const guildId = interaction.guildId;
                const owner = interaction.options.getString('owner');
                const repo = interaction.options.getString('repo');
                let choices, filtered;
    
                // Autocompletion for owners
                if (focusedOption.name === 'owner') {
                    // Get every owner, and filter by what's typed on Discord.
                    choices = await getAllOwners(guildId) || [];
                } else if (focusedOption.name === 'repo') {
                    choices = await getAllRepos(owner, guildId) || [];
                } else if (focusedOption.name === 'branch-title') {
                    choices = await getAllBranches(owner, repo, guildId) || [];    
                } else if (focusedOption.name === 'title') {
                    choices = (await getAllPullRequests(owner, repo, guildId)).map(pr => pr.title) || [];
                }

                if (choices.length === 0) {
                    throw new Error('No options found.');
                } else {
                    filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
                    if (filtered.length > 25) {
                        filtered = filtered.slice(0, 25);
                    }
                    await interaction.respond(
                        filtered.map(choice => ({ name: choice, value: choice })),
                    );
                }
                
            // Error handling for autocompletion
            } catch (error) {
                console.error('Error in autocomplete:', error.message);
                // Respond with an error message
                await interaction.respond([{ name: 'Error', value: 'An error occurred while loading the options.' }]);
            }
        },
        // Execute the command
    async execute(interaction){
        const owner = interaction.options.getString('owner'); // Get the owner of the repository
        const repo = interaction.options.getString('repo'); // Get the repository name
        const title = interaction.options.getString('title'); // Get the title of the pull request
        const branchTitle = interaction.options.getString('branch-title'); // Get the title of the branch
        const command = interaction.options.getSubcommand(); // Get the subcommand
        const guildId = interaction.guildId;
        const startTime = Date.now(); // Start time for the command

        /**
         * Function to respond with an embed
         * @param type - The type of thing delete
         * @returns {EmbedBuilder} - The embed to respond with
         */
        function respondEmbed(type, time) {
            const respondEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Github Update')
                .setDescription(`New ${type} deleted`)
                .setThumbnail('https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png')
                .setFooter({ text: `Done in ${time} seconds`});
            if (owner && repo && title) {
                respondEmbed.addFields(
                    { name: 'Owner:', value: owner, inline: true },
                    { name: 'Repo:', value: repo, inline: true },
                    { name: 'Title:', value: title, inline: true }
                );
            }
            if (owner && repo && branchTitle) {
                respondEmbed.addFields(
                    { name: 'Owner:', value: owner, inline: true },
                    { name: 'Repo:', value: repo, inline: true },
                    { name: 'Title:', value: branchTitle, inline: true },
                );
            }
            return respondEmbed;
        }

        let elapsedTime; // Variable to store the elapsed time
        
        try {
            await interaction.deferReply(); // Defer the reply
            await validation(guildId, owner, repo);
            
            switch (command) {
                case 'pullrequest':
                    // Delete a pull request
                    await closePullRequest(owner, repo, title, guildId);

                    elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
                    // Respond with an embed
                    await interaction.editReply({embeds: [respondEmbed('pull-request', elapsedTime)]});
                    break;
                case 'branch':
                    // Delete a branch
                    await deleteBranch(owner, repo, branchTitle, guildId);
                    elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

                    // Respond with an embed
                    await interaction.editReply({embeds: [respondEmbed('branch', elapsedTime)]});
                    break;
                default:
                    // If the subcommand is not recognized, send an error message
                    await interaction.editReply('Sorry, but I do not recognize the type of thing you want to create.');
                    break;
            }
        } catch (error) {
            elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
            await interaction.editReply({embeds: [errorEmbed(error.message, elapsedTime)]});
        }
    }
}
