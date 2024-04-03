import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
const bhPackFolder = `${process.env.APPDATA}\\..\\Local\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang\\behavior_packs\\`

export function main(project){
	const projectSrc = project+"(MCFS SRC)";
	const projectBuild = project+"(MCFS BUILD)";
	const buildPath = bhPackFolder + projectBuild + "\\";
	const srcPath = bhPackFolder + projectSrc + "\\";

	// Check if source exists
	if (fs.existsSync(bhPackFolder + projectSrc) === false){
		return console.log("Specified project does not exist.")
	}

	// Make build directory
	if (fs.existsSync(buildPath)) {
		fs.rmSync(buildPath, { recursive: true })
	}
	fs.mkdirSync(buildPath)

	// Write manifest.json
	const projectDetails = {
		name: null,
		description: null,
		headerUUID: null,
		moduleUUID: null
	}

	if (fs.existsSync(srcPath+"metadata") === false){
		return console.log("Metadata file is nonexistant, build process failed.");
	}
	let metadata = fs.readFileSync(srcPath+"metadata", {encoding: "utf8"});
	metadata = metadata.split(";");
	projectDetails.name = metadata[0];
	projectDetails.description = metadata[1];
	projectDetails.headerUUID = metadata[2];
	projectDetails.moduleUUID = metadata[3];

	// manifest.json
	fs.writeFileSync(buildPath+"manifest.json", `{
	"format_version": 2,
	"header": {
		"name": "${projectDetails.name}",
		"description": "${projectDetails.description}",
		"uuid": "${projectDetails.headerUUID}",
		"version": [1, 0, 0],
		"min_engine_version": [1, 19, 73]
	},
	"modules": [
		{
			"description": "${projectDetails.description}",
			"type": "data",
			"uuid": "${projectDetails.moduleUUID}",
			"version": [1, 0, 0]
		}
	],
	"metadata": {
		"Made with": "MCFS",
		"MCFS Source": "https://..."
	}
}`	);

	// Compile Functions
	function compileFunction(){

	}
	if(fs.existsSync(srcPath+"main.mcfs") === false){
		return console.log("Missing entry point (main.mcfs is nonexistant), build failed.");
	}
	compileFunction("./main.mcfs");

	// Finish
	console.log("Building finished.")
}