import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { generateCommandBlock } from "../mcstructure/coder.js";

const bhPackFolder = "./" //`${process.env.APPDATA}\\..\\Local\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang\\development_behavior_packs\\`

export function main(project) {
	const projectSrc = project + "(MCFS SRC)";
	const projectBuild = project + "(MCFS BUILD)";
	const buildPath = bhPackFolder + projectBuild + "/";
	const srcPath = bhPackFolder + projectSrc + "/";

	// Check if source exists
	if (fs.existsSync(bhPackFolder + projectSrc) === false) {
		return console.log("Specified project does not exist.")
	}

	// Make build directory
	if (fs.existsSync(buildPath)) {
		fs.rmSync(buildPath, { recursive: true })
	}
	fs.mkdirSync(buildPath)

	// Write !!READ_ME!!.txt
	fs.writeFileSync(buildPath+"!!READ_ME!!.txt", "## WARNING\nMODIFICATIONS TO ANYTHING IN THIS FOLDER *WILL* BE LOST. TO MAKE CHANGES PLEASE EDIT THE SRC FOLDER.\n\n## INFO\nThis behavior pack was generated using Minecraft Function Script (MCFS). Learn more about the project at https://...", "utf8")

	// Write manifest.json
	const projectDetails = {
		name: null,
		description: null,
		headerUUID: null,
		moduleUUID: null
	}

	if (fs.existsSync(srcPath + "metadata") === false) {
		return console.log("Metadata file is nonexistant, build process failed.");
	}
	let metadata = fs.readFileSync(srcPath + "metadata", { encoding: "utf8" });
	metadata = metadata.split(";");
	projectDetails.name = metadata[0];
	projectDetails.description = metadata[1];
	projectDetails.headerUUID = metadata[2];
	projectDetails.moduleUUID = metadata[3];

	// manifest.json
	fs.writeFileSync(buildPath + "manifest.json", `{
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

	// Make function directory
	fs.mkdirSync(buildPath+"functions")

	// Compile Functions
	const instructions = {};
	const scopes = [];
	class Instruction {
		constructor(name, onCall, onScopeEnd) {
			this.name = name;
			this.onCall = onCall;
			this.doesScope = !!onScopeEnd;
			if (this.doesScope === true) {
				new Scope(onScopeEnd);
			}
			instructions[name] = this;
		}
	}
	class Scope {
		constructor(onEnd) {
			this.contents = [];
			this.onEnd = onEnd;
			scopes.push(this);
		}
	}

	new Instruction("var", function(line){
		const type = line[1].substring(0, 1);
		if(type !== "$" || type !== "*"){

		}
	});

	new Instruction("cmd", function(line){
		line.shift();
		mcfunctOutput += line.join(" ");
		mcfunctOutput += "\n";
	})


	function compileFile(filePath) {
		if(fs.existsSync(srcPath+filePath) === false) throw new Error(`Tried to compile nonexistant file (${filePath})`);
		
		const fileContent = fs.readFileSync(srcPath+filePath, {encoding:"utf8"});
		let mcfunctOutput = "";
		const lineOutput = [];

		function genLineOutput(line){
			// Get the line of code
			for (let i = 0, iStart = 0; i < fileContent.length; i++) {
				if (fileContent[i] === ";" || fileContent[i] === "\r" || fileContent[i] === "\n" || i === fileContent.length-1) {
					const line = fileContent.substring(
						iStart, i + (i===fileContent.length-1&&fileContent[i]!==";"?1:0) // We need to go one more index at the end of files if it doesnt end in a ;
					).trim().replaceAll("\t", "");
					if(line !== "") compileLine(line);
					iStart = i+1;
				}
			}
			// Convert that line of code to a lineOutput array
			function compileLine(line){
				const lineArr = [];
				for(let i = 0, lastSpace = 0; i < line.length; i++){
					if(line[i] === " " || i === line.length-1){
						lineArr.push(line.substring(i+(i===line.length-1?1:0), lastSpace)); // We also need to go one more index at the end of lines
						lastSpace = i+1;
					}
				}
				lineOutput.push(lineArr);
			}
		}

		function genMcFunctOutput(){
			function compileArr(arr){
				for (let line of arr) {
					if(line[0] === "#") continue; // Skip comments

					if (scopes.length !== 0 && !scopeContentsExceptions.includes(line[0])) {
						scopes[scopes.length - 1].contents.push(line);
						continue;
					}

					if(instructions[line[0]]){
						instructions[line[0]].onCall(line);
					}else{
						throw new Error(`Unknown instruction "${line[0]}" (${line.join(" ")})`)
					}
					switch (line[0]) {

						case "var":
						break;
						case "cmd":
							break;
						case "repeat":
							let preMcFunctOutput = mcfunctOutput;
							mcfunctOutput = "";
							const times = Number(line[1]);

							new Scope(function () {
								for(let i = 0; i < times; i++){
									compileArr(JSON.parse(JSON.stringify(this.contents)))
								}
								mcfunctOutput = preMcFunctOutput + mcfunctOutput;
							})
							break;
						case "end":
							if (scopes.length === 0) {
								throw new Error("\"end\" instruction called while no scope is active")
							}
							scopes.pop().onEnd();
							break;
						default:
							break;
					}
				}
			}
			compileArr(lineOutput);

			if(scopes.length !== 0){
				throw new Error("Unanswered scope instruction");
			}
		}

		genLineOutput();
		genMcFunctOutput();

		fs.writeFileSync(`${buildPath}functions/${filePath.replace(".mcfs","")}.mcfunction`, mcfunctOutput, "utf-8");
	}
	compileFile("./main.mcfs");

	// Finish
	console.log("Building finished.")
}