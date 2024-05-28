import {EmbedBuilder} from "discord.js";

/**
 * Get the trello api name of the color
 * @param {string} colorName - color given on in the Discord command
 * @returns The color corresponding to colorName
 */
function convertToTrelloColor(colorName = null) {
    const colors = {
        'green':        {name: 'green', hex: '#446d50'},
        'subtle green': {name: 'green_light', hex: '#82cc98'},
        'bold green':   {name: 'green_dark', hex: '#314c39'},
        'blue':         {name: 'blue', hex: '#3056c8'},
        'subtle blue':  {name: 'blue_light', hex: '#709bfc'},
        'bold blue':    {name: 'blue_dark', hex: '#21346a'},
        'yellow':       {name: 'yellow', hex: '#765f15'},
        'subtle yellow':{name: 'yellow_light', hex: '#d5b12b'},
        'bold yellow':  {name: 'yellow_dark', hex: '#4f410c'},
        'sky':          {name: 'sky', hex: '#426981'},
        'subtle sky':   {name: 'sky_light', hex:'#8b8bde'},
        'bold sky':     {name: 'sky_dark', hex: '#2d4755'},
        'orange':       {name: 'orange', hex:'#91490a' },
        'subtle orange':{name: 'orange_light', hex:'#e8a166'},
        'bold orange':  {name: 'orange_dark', hex: '#633205'},
        'lime':         {name: 'lime', hex: '#576b2a' },
        'subtle lime':  {name: 'lime_light', hex: '#a4c653'},
        'bold lime':    {name: 'lime_dark', hex: '#3e4927' },
        'red':          {name: 'red', hex: '#963229' },
        'subtle red':   {name: 'red_light', hex: '#db7268'},
        'bold red':     {name: 'red_dark', hex: '#522420'},
        'pink':         {name: 'pink', hex: '#813f71'},
        'subtle pink':  {name: 'pink_light', hex: '#cd73b7'},
        'bold pink':    {name: 'pink_dark', hex: '#482941' },
        'purple':       {name: 'purple', hex: '#5a4fae' },
        'subtle purple':{name: 'purple_light', hex: '#998eec'},
        'bold purple':  {name: 'purple_dark', hex: '#363062'},
        'black':        {name: 'black', hex: '#5e6772'},
        'subtle black': {name: 'black_light', hex: '#8f9aa8'},
        'bold black':   {name: 'black_dark', hex: '#4a5059'}
      };

    if (colorName !== null) {
        return colors[colorName];
    } else {
        return colors;
    }
}
/**
 * ...
 * @param {string} colorName - ...
 * @returns ...
 */
function trelloColors() {
    const colors = [
        'green',
        'subtle green',
        'bold green',
        'blue',
        'subtle blue',
        'bold blue',
        'yellow',
        'subtle yellow',
        'bold yellow',
        'sky',
        'subtle sky',
        'bold sky',
        'orange',
        'subtle orange',
        'bold orange',
        'lime',
        'subtle lime',
        'bold lime',
        'red',
        'subtle red',
        'bold red',
        'pink',
        'subtle pink',
        'bold pink',
        'purple',
        'subtle purple',
        'bold purple',
        'black',
        'subtle black',
        'bold black',
    ]
    return colors;
}

/**
 * Function to create an error embed.
 * @param error - The error message
 * @returns {EmbedBuilder} - The error embed
 */
const errorEmbed = (error, time) => {
    return new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Error')
        .setDescription('An error has occurred.')
        .addFields(
            {name: 'Error message:', value: error}
        )
        .setFooter({ text: `Done in ${time} seconds`});
}

export { errorEmbed, trelloColors, convertToTrelloColor };