import * as fs from "node:fs";
import * as crypto from "node:crypto";
const bhPackFolder = "./" //`${process.env.APPDATA}\\..\\Local\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang\\development_behavior_packs\\`

export function main(inputs, flags) {
	const name = inputs[0];
	const description = inputs[1];
	if (/^[a-zA-Z0-9_]+$/g.test(name) === false || /^[a-zA-Z0-9_ ]+$/g.test(description) === false) {
		return console.log("The name may only contain letters a-z, 0-9, and underscores. The description may only contain a-z, 0-9, underscores, and spaces.");
	}
	let folderName = name + "(MCFS SRC)"

	if (fs.existsSync(bhPackFolder + folderName) === false) {
		// Make base folder
		fs.mkdir(bhPackFolder + folderName, function () {
			if (arguments[0] === null) return;
			console.error(arguments)
		})

		// Make main file
		fs.writeFileSync(bhPackFolder + folderName + "/metadata", `${name};${description};${crypto.randomUUID()};${crypto.randomUUID()}`)
		fs.writeFileSync(bhPackFolder + folderName + "/main.mcfs", `# Code below...`)
	}
}