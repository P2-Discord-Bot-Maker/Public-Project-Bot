import Discord, { EmbedBuilder } from 'discord.js'; // Importing Discord & embedBuilder from discord.js
import {createPullRequest, createBranch, getAllOwners, getAllRepos, getAllBranches, getAheadBranches, validation} from '../../github.js'; // Importing functions from github.js
import {errorEmbed} from "../../utils.js"; // Importing error Embed from utils.js

// Discord command to create cards, lists, and labels on Github.
export const command = {
    data: new Discord.SlashCommandBuilder()
        .setName('gcreate')
        .setDescription('Create on Github')
        // Subcommands to create a pullrequest
        .addSubcommand(
            subcommand =>
            subcommand
            .setName('pullrequest')
            .setDescription('Create a pull request on Github')
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
                .setRequired(true))
            .addStringOption(
                option =>
                option.setName('base')
                .setDescription('The branch you want to merge into')
                .setAutocomplete(true)
                .setRequired(true))
            .addStringOption(
                option =>
                option.setName('head')
                .setDescription('The branch you want to merge into the base branch')
                .setAutocomplete(true)
                .setRequired(true))
        )
        // Subcommand to create a branch
        .addSubcommand
        (subcommand =>
            subcommand.setName('branch')
            .setDescription('Create a branch on Github')
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
                option.setName('branch-title')
                .setDescription('Name of the branch')
                .setRequired(true))
        ),

    async autocomplete(interaction) {
        try {
            const focusedOption = interaction.options.getFocused(true); // The active field on Github.
            const guildId = interaction.guildId;
            const owner = interaction.options.getString('owner');
            const repo = interaction.options.getString('repo');
            const base = interaction.options.getString('base');

            let choices, filtered;

            // Autocompletion for owners
            if (focusedOption.name === 'owner') {
                // Get every owner, and filter by what's typed on Github.
                choices = await getAllOwners(guildId);
            } else if (focusedOption.name === 'repo') {
                // Get all repos
                choices = await getAllRepos(owner, guildId);
            } else if (focusedOption.name === 'base') {             
                // Get all branches   
                choices = await getAllBranches(owner, repo, guildId);
            } else if (focusedOption.name === 'head') {
                // Get all branches that are ahead of the previously typed branch
                choices = await getAheadBranches(owner, repo, base, guildId);                
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
            console.error('Error in autocomplete:', error.message);
            // Respond with an error message
            await interaction.respond([{ name: 'Error', value: 'An error occurred while loading the options.' }]);
        }
    },
    
    async execute(interaction){
        const owner = interaction.options.getString('owner'); // Get the owner of the repository
        const repo = interaction.options.getString('repo'); // Get the repository name
        const title = interaction.options.getString('title'); // Get the title of the pull request
        const branchTitle = interaction.options.getString('branch-title'); // Get the title of the branch
        const head = interaction.options.getString('head'); // Get the head branch
        const base = interaction.options.getString('base'); // Get the base branch

        const command = interaction.options.getSubcommand(); // Get the subcommand
        const guildId = interaction.guildId;

        const startTime = Date.now(); // Start time for the command

        /**
         * Function to respond with an embed
         * @returns {EmbedBuilder} - The embed to respond with
         */
        function respondEmbed(type, time) {
            const respondEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Github Update')
                .setDescription(`New ${type} created`)
                .setThumbnail('https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png')
                .setFooter({ text: `Done in ${time} seconds`});
            if (owner && repo && title && head && base) {
                respondEmbed.addFields(
                    { name: 'Owner:', value: owner, inline: true },
                    { name: 'Repo:', value: repo, inline: true },
                    { name: 'Title:', value: title, inline: true },
                    { name: 'Head:', value: head, inline: true },
                    { name: 'Base:', value: base, inline: true },
                );
            }
            if (owner && repo && branchTitle && !head && !base) {
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
            await validation(guildId, owner, repo, undefined, undefined, undefined, undefined, branchTitle); // Validate the input
            switch (command) {
                case 'pullrequest': 
                    // Check if the head and base branches are the same 
                    if (head === base) { throw new Error('The head and base branches cannot be the same.'); }
                    // Create a new pull request
                    await createPullRequest(owner, repo, title, head, base, guildId);
                    elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time

                    // Respond with an embed
                    await interaction.editReply({embeds: [respondEmbed('pull-request', elapsedTime)]});
                    break;
                case 'branch':
                    // Create a new branch
                    await createBranch(owner, repo, branchTitle, guildId);
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
            console.log('gCreate Error: ' + error.message);
            elapsedTime = ((Date.now() - startTime)/1000).toFixed(2); // Get the elapsed time
            await interaction.editReply({embeds: [errorEmbed(error.message, elapsedTime)]});
        }
    }
}
