import fs from 'fs';
import path from 'path';
import util from 'util';

//Used to turn callback functions into promise functions
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

/**
 * Imports a file based on file path and return an array of all commands found in that file
 * @param {string} path 
 * @returns array of commands
 */
async function get_commands_from_file(filePath){
	let commands = [];
	try {
		const module = await import(`file://${filePath}`);

		for (const key in module) {
			commands.push(module[key])
		}

	} catch (error) {
		console.error(`Error importing module from ${filePath}:`, error);
	}
	return commands;
}

/**
 * Reads all commands from folder src/backend/commands and returns.
 * @returns array of commands
 */
async function get_commands(integration = null) {
  let commands = [];
	
/**
 * Reads all commands from folder src/backend/commands and returns.
 * @returns array of commands
 */
  async function readCommandsRecursively(currentPath) {
      try {
        const items = await readdir(currentPath);
        // Loop through each item in the directory
        for (const item of items) {
          // Get the full path of the item
          const itemPath = path.join(currentPath, item);
          const itemStat = await stat(itemPath);
		  
        // Check if file or directory
          if (itemStat.isFile()) {
          // Is a file
			let new_commands = await get_commands_from_file(itemPath);
          commands = commands.concat(new_commands);
          } else {
          // Is directory
            await readCommandsRecursively(itemPath);
          }
        }
      } catch (error) {
        console.error('Error reading directory:', error);
      }
    }

    const isWindows = process.platform == 'win32';
  const urlPath = new URL(import.meta.url).pathname;
    const decodePath = decodeURI(isWindows ? urlPath.slice(1) : urlPath);
  const rootPath = path.resolve(path.dirname(decodePath), '../backend/commands');
    console.log("Reading commands from", rootPath);

	// If integration is not null, ensure that it only reads from the appropriate folder
  if (integration !== null) {
    console.log('Integration:', integration);
	  // Create path by using the integration and joining it with the rootPath
    const integrationPath = path.join(rootPath, integration);
    await readCommandsRecursively(integrationPath);
	  // Otherwise read from all folders.
  } else {
    await readCommandsRecursively(rootPath);
  }

	// Return the found commands.
    return commands;
}

/**
 * Prints names of all commands
 */
async function list_commands(){
    let commands = await get_commands();
    commands.forEach(command => console.log(command.data.name));
}
export {get_commands, list_commands}