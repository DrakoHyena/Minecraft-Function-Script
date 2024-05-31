// TODO: Fix the last character getting cut off when the structure command is inserted

import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateCommandBlock } from "../mcstructure/coder.js";
import { genCode } from "../codegen/index.js";
import { pathToFileURL } from "node:url";
import { get } from "node:http";
import { tmpdir } from "node:os";

let bhPackFolder = `${process.env.APPDATA}\\..\\Local\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang\\development_behavior_packs\\`

export function main(inputs, flags) {
	const buildStart = Date.now();
	const project = inputs[0];
	const projectSrc = project + "(MCFS-SRC)";
	const projectBuild = project + "(MCFS-BUILD)";
	let buildPath = bhPackFolder + projectBuild + "/";
	let srcPath = bhPackFolder + projectSrc + "/";

	if(flags.includes("-test")){
		buildPath = "./tests/build/"+projectBuild+"/";
		srcPath = "./tests/src/"+projectSrc+"/";
	}
	if (flags.includes("-random")){
		buildPath = "./tests/random/" + projectBuild + "/";
		srcPath = "./tests/random/" + projectSrc + "/";
	}

	// Check if source exists
	if (fs.existsSync(srcPath) === false){
		return console.log("Specified project does not exist.")
	}

	// Make build directory
	if (fs.existsSync(buildPath)) {
		fs.rmSync(buildPath, { recursive: true })
	}
	fs.mkdirSync(buildPath)

	// Write !!READ_ME!!.txt
	fs.writeFileSync(buildPath + "!!READ_ME!!.txt", "## WARNING\nMODIFICATIONS TO ANYTHING IN THIS FOLDER *WILL* BE LOST. TO MAKE CHANGES PLEASE EDIT THE SRC FOLDER.\n\n## INFO\nThis behavior pack was generated using Minecraft Function Script (MCFS). Learn more about the project at https://github.com/DrakoHyena/Minecraft-Function-Script\n\n## Removing an MCFS pack from your world\nTo remove an MCFS pack from your world simiply run the following in the following:\n/function mcfs-remove-<packname>-<gibberish>\nWhere pack name is the pack you're removing and gibberish is just some letters or number that follow the pack name, you should see it in the auto complete.\nThis will stop the pack from running and remove all scoreboards associated with the pack making clean up quick and easy!", "utf8")

	// Copy pack_icon.png
	fs.writeFileSync(buildPath+"pack_icon.png", fs.readFileSync("./pack_icon.png"))

	// Write manifest.json
	const projectDetails = {
		mcfsVersion: null,
		projectCode: null,
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
	projectDetails.mcfsVersion = metadata[0];
	projectDetails.projectCode = metadata[1];
	projectDetails.name = metadata[2];
	projectDetails.description = metadata[3];
	projectDetails.headerUUID = metadata[4];
	projectDetails.moduleUUID = metadata[5];

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
		"MCFS Source": "https://github.com/DrakoHyena/Minecraft-Function-Script"
	}
}`	);

	// Make function and structure directory
	fs.mkdirSync(buildPath + "functions")
	fs.mkdirSync(buildPath + "structures");

	// Make the init and removal function
	(()=>{
		let nameBase = `mcfs-${projectDetails.name}-${projectDetails.projectCode}`
		let initFunctionRunName = `${nameBase}-run_init`
		let initFunctionRunContent = ""
		initFunctionRunContent += "tickingarea add circle 0 -64 0 4 mcfs_loader true\n"
		initFunctionRunContent += `scoreboard objectives add ${nameBase}-vars dummy\n`
		initFunctionRunContent += `scoreboard players set init ${nameBase} 1\n`

		let initFunctionTestName = `${nameBase}-test_init`
		let initFunctionTestContent = ""
		initFunctionTestContent += `scoreboard objectives add ${nameBase} dummy\n`
		initFunctionTestContent += `scoreboard players add init ${nameBase} 0\n`
		initFunctionTestContent += `execute if score init ${nameBase} matches 0 run function ${initFunctionRunName}\n`

		// Make removal funtion
		let removalFunctionName = `mcfs-remove-${projectDetails.name}-${projectDetails.projectCode}`
		let removalFunctionContent = `scoreboard objectives remove ${nameBase}-vars\n`
		removalFunctionContent += `scoreboard players set init ${nameBase} -1\n`
		removalFunctionContent += `say ${projectDetails.name} has largely been removed. Make sure to remove any command blocks refrencing it then remove the pack from the world. Certain MCFS components that are required for MCFS to work will still remain such as certain scoreboards or tickingareas.`

		fs.writeFileSync(`${buildPath}functions/${initFunctionRunName}.mcfunction`, initFunctionRunContent, "utf8");
		fs.writeFileSync(`${buildPath}functions/${initFunctionTestName}.mcfunction`, initFunctionTestContent, "utf8");
		fs.writeFileSync(`${buildPath}functions/${removalFunctionName}.mcfunction`, removalFunctionContent, "utf8");
		fs.writeFileSync(`${buildPath}functions/tick.json`, JSON.stringify({values:[initFunctionTestName]}), "utf8");
	})()

	// Compiler Functions and classes
	const instructions = {};
	const current = {
		scope: undefined,
		file: undefined
	}
	const log = {
		content: `[${(new Date).toLocaleString()}] Building: ${projectDetails.name}\n`,
		warnings: 0,
		info: 0,
		unsafeMethods: 0
	}
	log.add = function(type, msg, line) {
		log.content += `[${type}][File:${current.file.relPath}][Line:${line.line}] ${msg}\n`
	}
	log.write = function() {
		if (fs.existsSync(buildPath)) {
			fs.writeFileSync(buildPath + "build_log.txt", log.content, "utf8")
			console.log(`Build logs written to build_log.txt\n- Warnings: ${log.warnings}\n- Unsafe Methods: ${log.unsafeMethods}\n- Info: ${log.info}`)
		}else{
			console.log("Failed to write build logs due to the buildPath not existing");
		}
	}

	const files = [];
	const gameVarScoreboard = `mcfs-${projectDetails.name}-${projectDetails.projectCode}-vars`
	const gameVarList = [];

	class MCFSError extends Error {
		constructor(type, message, line) {
			super(message);
			// Set up the error
			this.name = type;
			const stackArr = this.stack.split("\n");
			this.stack = stackArr.shift()+"\n";
			this.stack += `    at ${pathToFileURL(current.file.path)}:${line?.line!==undefined?line.line:current.scope.startingLine}:0`
			if(line) this.stack += `\nLINE IN MCFS FILE\n    ${line.join(" ")}`
			if (flags.includes("-v") === true) {
				this.stack += "\nCOMPILER STACK TRACE\n"
				this.stack += stackArr.join("\n")
			}

			// Write the logs
			log.write()
		}
	}

	class File {
		constructor(path, relPath) {
			// Game
			this.functionOutput = "";
			this.outputLines = 0;

			// Compiler
			this.srcLine = 0;
			this.path = path;
			this.relPath = relPath;
			this.scopes = [];

			files.push(this);
			current.file = this;
		}
	}
	class Scope {
		constructor(instruction, startingLine) {
			this.instruction = instruction; // The instruction associated with the scope, used for instruction.onScopeEnd
			this.contents = []; // Where instructions inside the scope are stored
			this.collectInstructions = true; // Whether or not we should collect instructions instead of running them
			this.compVars = {}; // Where compiler variables ($) in the scope get stored
			this.gameVars = {}; // Where game variables(&) in the scope get stored
			this.startingLine = startingLine; // The line where the scope starts, used in errors
			current.file.scopes.push(this); // Adding our scope to the scope stack
			current.scope = this;
		}
		setCompVar(name, value, line){
			for (let i = current.file.scopes.length - 1; i > -1; i--) {
				if (current.file.scopes[i].compVars[name] !== undefined) {
					return current.file.scopes[i].compVars[name] = value
				}
			}
			this.compVars[name] = value;
		}
		getCompVar(name, line) {
			for (let i = current.file.scopes.length - 1; i > -1; i--) {
				if (current.file.scopes[i].compVars[name] !== undefined) {
					return current.file.scopes[i].compVars[name]
				}
			}
			throw new MCFSError("User Error", `Compiler variable "${name}" is not defined`, line)
		}
		setGameVar(name, value, line){
			// If the gameVar is in ours or higher scope
			for (let i = current.file.scopes.length - 1; i > -1; i--) {
				if (current.file.scopes[i].gameVars[name] !== undefined) {
					current.file.scopes[i].gameVars[name].value = value
					return current.file.scopes[i].gameVars[name]
				}
			}

			// If we need to make the gamevar
			let gameVarsIndex = undefined;
			for (let i = 0; i < gameVarList.length; i++) {
				let gVar = gameVarList[i];
				if (gVar.inUse === false) {
					gVar.inUse = true;
					gVar.value = value;
					gameVarsIndex = i;
					break;
				}
			}
			if (gameVarsIndex === undefined) gameVarsIndex = gameVarList.push({ inUse: true, value: value, entryName: `var${gameVarList.length}` })-1;
			return this.gameVars[name] = gameVarList[gameVarsIndex];
		}
		getGameVar(name, line) {
			for (let i = current.file.scopes.length - 1; i > -1; i--) {
				if (current.file.scopes[i].gameVars[name] !== undefined) {
					return current.file.scopes[i].gameVars[name]
				}
			}
			throw new MCFSError("User Error", `Game variable "${name}" is not defined`, line)
		}
		discard(){
			for(let gVar in this.gameVars){
				this.gameVars[gVar].inUse = false
			}
		}
	}

	class Instruction {
		constructor(name, onCall, onScopeEnd) {
			this.name = name; // Checking is instruction exists
			this.doesScope = !!onScopeEnd; // Checking is instruction needs to make scopes
			this.onScopeEnd = onScopeEnd; // Called when the instruction's scope ends
			this.onCall = onCall; // Called when the instruction is executed
			instructions[name] = this; // Making our instruction discoverable
		}
	}

	function parseString(str, line=undefined){
		if(str.startsWith(`"`) === false || str.endsWith(`"`) === false){
			throw new MCFSError("User Error", "Malformed string", line)
		}
		// TODO: Check if line count still works correctly
		// TODO: add escaping and replacing
		// TODO: yell at em for unmatched "
		return str.substring(1, str.length-1)
	}

	function warnGameVarRange(name, value, line){
		if (value > 2147483647) {
			log.add("Warning", `Game variable "${name}" was calculated to be above the maximum value of 2147483647`, line);
			log.warnings++;
		}else if (value < -2147483648) {
			log.add("Warning", `Game variable "${name}" was calculated to be below the minimum value of -2147483648`, line);
			log.warnings++;
		}
	}

	class Tellraw{
		constructor(selector){
			this.rawtextArr = [];
			this.command = `tellraw ${selector} `
		}
		add(type, thing1, thing2){
			switch(type){
				case "text":
					this.rawtextArr.push({"text":thing1.replaceAll(`"`, `\\"`)})
				break;
				case "selector":
					this.rawtextArr.push({"selector":thing1.replaceAll(`"`, `\\"`)})
				break;
				case "score":
					this.rawtextArr.push({"score":{"name":thing1, "objective": thing2}})
				break;
			}
			return this;
		}
		build(){
			return this.command + `{"rawtext":${JSON.stringify(this.rawtextArr)}}`
		}
	}

	// Instructions
	// VAR INSTRUCTION
	new Instruction("var", (line, scope)=>{
		const type = line[1].substring(0, 1);
		const name = line[1].substring(1);
		const operation = line[2];
		const value = line[3];
		let tempVar = 0;
		switch(type){
			// Compiler variables
			case "$":
				switch(operation){
					case "=":
						// Equal: nothing
						if(value === undefined){
							throw new MCFSError("User Error", "Cannot set a compiler variable to nothing", line);
						}

						// Equal: scoreboard
						if(line[3] === "scoreboard"){
							throw new MCFSError("User Error", "Compiler variables cannot be set to scoreboard values", line)
						}

						// Equal: game variable
						if(line[3].startsWith("&")){
							throw new MCFSError("User Error", "Compiler variables cannot be set to game variables", line)
						}

						// Equal: comp variable
						if(line[3].startsWith("$")){
							if(line[4]) throw new MCFSError("User Error", `Assignment should only contain a compiler variable, also found "${line[4]}"`, line)
							scope.setCompVar(name, scope.getCompVar(value.substring(1), line));
							return;
						}

						// Equal: string
						tempVar = line.slice(3).join(" ");
						if (tempVar.startsWith(`"`)){
							tempVar = parseString(tempVar, line);
							scope.setCompVar(name, tempVar, line);
							return
						}

						// Equal: number
						tempVar = Number(tempVar.replaceAll(",", ""));
						if (isNaN(tempVar)){
							throw new MCFSError("User Error", "Malformed string", line);
						}else{
							scope.setCompVar(name, tempVar, line)
						}
					break;
					case "+":
						// Add: nothing
						if (value === undefined) {
							throw new MCFSError("User Error", "Cannot add nothing to a compiler variable", line);
						}

						tempVar = Number(value);
						if (isNaN(tempVar)){
							// Add: variable
							if (value.startsWith("$") === true){
								if (line[4]) throw new MCFSError("User Error", `Value should only be a compiler variable, also found "${line[4]}"`, line)
								tempVar = value.substring(1);
								scope.setCompVar(name,
									scope.getCompVar(name, line) + scope.getCompVar(tempVar, line),
								line)
							}else{ // Add: string
								scope.setCompVar(name,
									scope.getCompVar(name, line) + parseString(value, line),
								line)
							}
						}else{ // Add: number
							scope.setCompVar(name,
								scope.getCompVar(name, line) + tempVar,
							line)
						}
					break;
					case "-":
						// Subtract: nothing
						if (value === undefined) {
							throw new MCFSError("User Error", "Cannot subtracting nothing from a compiler variable", line);
						}

						// Subtract: string
						tempVar = scope.getCompVar(name, line);
						if (typeof tempVar !== "number"){
							throw new MCFSError("User Error", `Cannot subtract from a string`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)){
							throw new MCFSError("User Error", `Cannot subtract using a string`, line)
						}else{
						// Subtract: number
							scope.setCompVar(name,
								scope.getCompVar(name, line) - value,
							line)
						}
					break;
					case "*":
						// Multiply: nothing
						if (value === undefined) {
							throw new MCFSError("User Error", "Cannot multiply a compiler variable by nothing", line);
						}

						// Multiply: string
						tempVar = scope.getCompVar(name, line);
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Cannot multiply a string`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Cannot multiply using a string`, line)
						} else {
						// Multiply: numver
							scope.setCompVar(name,
								scope.getCompVar(name, line) * value,
							line)						}
					break;
					case "/":
						// Divide: nothing
						if (value === undefined) {
							throw new MCFSError("User Error", "Cannot divide a compiler variable by nothing", line);
						}

						// Divide: string
						tempVar = scope.getCompVar(name, line);
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Cannot divide a string`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Cannot divide using a string`, line)
						} else {
						// Divide: number
							scope.setCompVar(name,
								scope.getCompVar(name, line) / value,
							line)
						}
					break;
					case "^":
						// Exponentiate: nothing
						if (value === undefined) {
							throw new MCFSError("User Error", "Cannot exponentiate a compiler variable by nothing", line);
						}

						// Exponentiate: string
						tempVar = scope.getCompVar(name, line);
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Cannot exponentiate a string`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Cannot exponentiate using a string`, line)
						} else {
						// exponentiate: number
							scope.setCompVar(name,
								scope.getCompVar(name, line) ** value,
							line)
						}
					break;
					case "%":
						// Modulate: nothing
						if (value === undefined) {
							throw new MCFSError("User Error", "Cannot modulate a compiler variable by nothing", line);
						}

						// Modulate: string
						tempVar = scope.getCompVar(name, line);
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Cannot modulate a string`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Cannot modulate using a string`, line)
						} else {
						// Modulate: number
							scope.setCompVar(name,
								scope.getCompVar(name, line) % value,
							line)
						}
					break;
					case "round":
						if (line[4]) throw new MCFSError("User Error", `Value should only up, down, or auto. However "${line[4]}" was also found`, line)
						tempVar = scope.getCompVar(name, line)
						if(line[3] === "up"){
							scope.setCompVar(name, Math.ceil(tempVar), line);
						}else if(line[3] === "down"){
							scope.setCompVar(name, Math.floor(tempVar), line);
						}else if(line[3] === "auto"){
							scope.setCompVar(name, Math.round(tempVar), line);
						}else{
							throw new MCFSError("User Error", `"${line[3]}" is not a valid rounding option`);
						}
					break;
					default:
						throw new MCFSError("User Error", `Unknown variable operation "${operation}"`, line);
					break;
				}
			break;
			// Game variables
			case "&": // TODO: Finish game variables
				switch (operation) {
					case "=":
						// Equal: nothing
						if (value === undefined) {
							throw new MCFSError("User Error", "Cannot set a game variable to nothing", line);
						}

						// Equal: scoreboard
						if(line[3] === "scoreboard"){
							if (line[6]) throw new MCFSError("User Error", `Assignment should only be a selector and a scoreboard. However "${line[4]}" was also found`, line)
							if(line[4] === undefined || line[5] === undefined){
								throw new MCFSError("User Error", "Missing selector or scoreboard when setting a game variable to a scoreboard")
							}
							let varObj = scope.setGameVar(name, 0, line);
							current.file.functionOutput += `scoreboard players operation ${varObj.entryName} ${gameVarScoreboard} = ${line[4]} ${line[5]}\n`;
							current.file.outputLines++;
							log.unsafeMethods++;
							log.add("Unsafe Method", "MCFS cannot guarantee if the player or scoreboard you are calling exists. This can cause unexpected behavior.", line)
							return;
						}

						// Equal: compiler variable
						if (line[3].startsWith("$")) {
							if (line[4]) throw new MCFSError("User Error", `Assignment should only contain a compiler variable, also found "${line[4]}"`, line)
							tempVar = Number(scope.getCompVar(value.substring(1), line));
							if(isNaN(tempVar)){
								throw new MCFSError("User Error", "Tried to set game variable to compiler variable but the compiler variable was a string")
							}
							if(tempVar - Math.floor(tempVar) !== 0){
								throw new MCFSError("User Error", "Tried to set a game variable to a compiler variable but the compiler variable had decimals")
							}
							let varObj = scope.setGameVar(name, tempVar, line)
							warnGameVarRange(name, varObj.value, line);
							current.file.functionOutput += `scoreboard players set ${varObj.entryName} ${gameVarScoreboard} ${tempVar}\n`;
							current.file.outputLines++;
							return;
						}
						
						// Equal: game variable
						if(line[3].startsWith("&")){
							if (line[4]) throw new MCFSError("User Error", `Assignment should only contain a game variable, also found "${line[4]}"`, line)
							tempVar = scope.getGameVar(line[3].substring(1), line)
							let varObj = scope.setGameVar(name, tempVar.value, line)
							warnGameVarRange(name, varObj.value, line);
							current.file.functionOutput += `scoreboard players operation ${varObj.entryName} ${gameVarScoreboard} = ${tempVar.entryName} ${gameVarScoreboard}\n`;
							current.file.outputLines++;
							return;
						}

						tempVar = Number(line.slice(3).join(" ").replaceAll(",", ""));
						if (isNaN(tempVar)) {
						// Equal: string
							throw new MCFSError("User Error", "Game variables can only be numbers", line);
						} else {
						// Equal: number
							if (tempVar > 2147483647) throw new MCFSError("User Error", "Game variables cannot be higher than 2147483647")
							if (tempVar < -2147483648) throw new MCFSError("User Error", "Game variables cannot be lower than -2147483648")
							if (tempVar - Math.floor(tempVar) !== 0) throw new MCFSError("User Error", "Game variables must be integers")
							let varObj = scope.setGameVar(name, tempVar, line);
							current.file.functionOutput += `scoreboard players set ${varObj.entryName} ${gameVarScoreboard} ${tempVar}\n`;
							current.file.outputLines++;
						}
						break;
					case "+":
						// Add: nothing
						if (value === undefined) {
							throw new MCFSError("User Error", "Cannot add nothing to a game variable", line);
						}

						// Add: scoreboard
						if (line[3] === "scoreboard") {
							if (line[6]) throw new MCFSError("User Error", `Addition should only be a selector and a scoreboard. However "${line[4]}" was also found`, line)
							if (line[4] === undefined || line[5] === undefined) {
								throw new MCFSError("User Error", "Missing selector or scoreboard when adding a scoreboard to a game variable")
							}
							scope.setGameVar(name, 0, line);
							current.file.functionOutput += `scoreboard players operation ${scope.getGameVar(name, line).entryName} ${gameVarScoreboard} += ${line[4]} ${line[5]}\n`;
							current.file.outputLines++;
							log.unsafeMethods++;
							log.add("Unsafe Method", "MCFS cannot guarantee if the player or scoreboard you are calling exists. This can cause unexpected behavior.", line)
							return;
						}
						
						// Add: compiler variable
						if (line[3].startsWith("$")) {
							if (line[4]) throw new MCFSError("User Error", `Addition should only contain a compiler variable, also found "${line[4]}"`, line)
							tempVar = Number(scope.getCompVar(value.substring(1), line));
							if (isNaN(tempVar)) {
								throw new MCFSError("User Error", "Tried to add a compiler variable to a game variable but the compiler variable was a string")
							}
							if (tempVar - Math.floor(tempVar) !== 0) {
								throw new MCFSError("User Error", "Tried to add a compiler variable to a game variable but the compiler variable had decimals")
							}
							let varObj = scope.setGameVar(name, scope.getGameVar(name, line).value+tempVar, line)
							warnGameVarRange(name, varObj.value, line);
							current.file.functionOutput += `scoreboard players add ${varObj.entryName} ${gameVarScoreboard} ${tempVar}\n`;
							current.file.outputLines++;
							return;
						}

						// Add: game variable
						if (line[3].startsWith("&")) {
							if (line[4]) throw new MCFSError("User Error", `Addition should only contain a game variable, also found "${line[4]}"`, line)
							tempVar = scope.getGameVar(line[3].substring(1), line)
							let varObj = scope.setGameVar(name, scope.getGameVar(name, line).value + tempVar.value, line)
							warnGameVarRange(name, varObj.value, line);
							current.file.functionOutput += `scoreboard players operation ${varObj.entryName} ${gameVarScoreboard} += ${tempVar.entryName} ${gameVarScoreboard}\n`;
							current.file.outputLines++;
							return;
						}

						tempVar = Number(line.slice(3).join(" ").replaceAll(",", ""));
						if (isNaN(tempVar)) {
							// Add: string
							throw new MCFSError("User Error", "Cannot append strings to game variables", line);
						} else {
							// Add: number
							let varObj = scope.setGameVar(name, scope.getGameVar(name, line).value + tempVar, line);
							warnGameVarRange(name, varObj.value, line);
							if (tempVar - Math.floor(tempVar) !== 0) throw new MCFSError("User Error", "Game variables must be integers")
							current.file.functionOutput += `scoreboard players add ${varObj.entryName} ${gameVarScoreboard} ${tempVar}\n`;
							current.file.outputLines++;
						}
						break;
					case "-":
						// Subtract: nothing
						if (value === undefined) {
							throw new MCFSError("User Error", "Cannot subtract nothing from a game variable", line);
						}

						// Subtract: scoreboard
						if (line[3] === "scoreboard") {
							if (line[6]) throw new MCFSError("User Error", `Subtraction should only be a selector and a scoreboard. However "${line[4]}" was also found`, line)
							if (line[4] === undefined || line[5] === undefined) {
								throw new MCFSError("User Error", "Missing selector or scoreboard when subtracting a scoreboard from a game variable")
							}
							scope.setGameVar(name, 0, line);
							current.file.functionOutput += `scoreboard players operation ${scope.getGameVar(name, line).entryName} ${gameVarScoreboard} -= ${line[4]} ${line[5]}\n`;
							current.file.outputLines++;
							log.unsafeMethods++;
							log.add("Unsafe Method", "MCFS cannot guarantee if the player or scoreboard you are calling exists. This can cause unexpected behavior.", line)
							return;
						}

						// Subtract: compiler variable
						if (line[3].startsWith("$")) {
							if (line[4]) throw new MCFSError("User Error", `Subtraction should only contain a compiler variable, also found "${line[4]}"`, line)
							tempVar = Number(scope.getCompVar(value.substring(1), line));
							if (isNaN(tempVar)) {
								throw new MCFSError("User Error", "Tried to subtract a compiler variable from a game variable but the compiler variable was a string")
							}
							if (tempVar - Math.floor(tempVar) !== 0) {
								throw new MCFSError("User Error", "Tried to subtract a compiler variable to a game variable but the compiler variable had decimals")
							}
							let varObj = scope.setGameVar(name, scope.getGameVar(name, line).value - tempVar, line)
							warnGameVarRange(name, varObj.value, line);
							current.file.functionOutput += `scoreboard players remove ${varObj.entryName} ${gameVarScoreboard} ${tempVar}\n`;
							current.file.outputLines++;
							return;
						}

						// Subtract: game variable
						if (line[3].startsWith("&")) {
							if (line[4]) throw new MCFSError("User Error", `Subtraction should only contain a game variable, also found "${line[4]}"`, line)
							tempVar = scope.getGameVar(line[3].substring(1), line)
							let varObj = scope.setGameVar(name, scope.getGameVar(name, line).value + tempVar.value, line)
							warnGameVarRange(name, varObj.value, line);
							current.file.functionOutput += `scoreboard players operation ${varObj.entryName} ${gameVarScoreboard} -= ${tempVar.entryName} ${gameVarScoreboard}\n`;
							current.file.outputLines++;
							return;
						}

						tempVar = Number(line.slice(3).join(" ").replaceAll(",", ""));
						if (isNaN(tempVar)) {
							// Subtract: string
							throw new MCFSError("User Error", "Cannot subtract strings from game variables", line);
						} else {
							// Subtract: number
							let varObj = scope.setGameVar(name, scope.getGameVar(name, line).value - tempVar, line);
							warnGameVarRange(name, varObj.value, line);
							if (tempVar - Math.floor(tempVar) !== 0) throw new MCFSError("User Error", "Game variables must be integers")
							current.file.functionOutput += `scoreboard players remove ${varObj.entryName} ${gameVarScoreboard} ${tempVar}\n`;
							current.file.outputLines++;
						}
						break;
					case "*":
						tempVar = scope.getCompVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to multiply a non-numeric variable (${name}: ${variable})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to multiply using a non-numeric value (${value})`, line)
						} else {
							scope.getCompVarList(name, line)[name] *= value;
						}
						break;
					case "/":
						tempVar = scope.getCompVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to divide a non-numeric variable (${name}: ${variable})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to divide using a non-numeric value (${value})`, line)
						} else {
							scope.getCompVarList(name, line)[name] /= value;
						}
						break;
					case "^":
						throw new MCFSError("User Error", "Minecraft doesnt support exponentiation of game vars. Use a repeat with multiplication instead.")
						break;
					case "%":
						tempVar = scope.getCompVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to modulate a non-numeric variable (${name}: ${variable})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to modulate using a non-numeric value (${value})`, line)
						} else {
							scope.getCompVarList(name, line)[name] %= value;
						}
						break;
					default:
						throw new MCFSError("User Error", `Unknown variable operation "${operation}"`, line);
						break;
				}
			break;
			default:
				throw new MCFSError("User Error", `Unknown variable type "${type}"`, line);
			break;
		}
	});

	// CMD INSTRUCTION
	new Instruction("cmd", (line, scope)=>{
		line.shift();
		if(line[0] === "function"){
			throw new MCFSError("User Error", "Functions cannot be called using the cmd instruction. Use callexternalfunct instead. Read the callexternalfunct section in the docs to learn more.")
		}
		for(let str of line){
			if(str[0] === "$"){
				str = scope.getCompVar(str.substring(1), line)
			}
			current.file.functionOutput += str + " "
		}
		current.file.functionOutput += "\n";
		current.file.outputLines++;
	})

	// REPEAT INSTRUCTION
	new Instruction("repeat", function(line, scope){
		scope.storedOutput = current.file.functionOutput;
		scope.times = Number(line[1].replaceAll(",", ""));
		current.file.functionOutput = "";
	}, function(scope){
		scope.collectInstructions = false;
		for (let i = 0; i < scope.times; i++) {
			scope.compVars = {};
			scope.gameVars = {};
			processInstructionArray(structuredClone(scope.contents))
		}
		current.file.scopes.pop();
		current.file.functionOutput = scope.storedOutput + current.file.functionOutput;
	})

	// END INSTRUCTION
	new Instruction("end", (line, scope)=>{
		if (current.file.scopes.length === 0) {
			throw new MCFSError("User Error", "\"end\" instruction called while no scope is active", line);
		}
		current.scope.instruction.onScopeEnd(scope);
		current.scope.discard();
		current.scope = current.file.scopes[current.file.scopes.length-1]
	})

	// DEFFFUNCT INSTRUCTION
	new Instruction("deffunct", (line, scope)=>{

	}, function(scope){
		
	})

	// LOG INSTRUCTION
	new Instruction("log", (line, scope)=>{
		let tellraw = undefined
		let tempStr = "";
		for (let str of line.slice(1)) {
			if (str[0] === "$") {
				tempStr += scope.getCompVar(str.substring(1), line)
				continue;
			}
			if(str[0] === "&"){
				if (tellraw === undefined) tellraw = new Tellraw("@a").add("text", `§7[${current.file.relPath}][${line.line}] `)
				if(tempStr !== ""){
					tellraw.add("text", tempStr);
					tempStr = "";
				}
				tellraw.add("score", scope.getGameVar(str.substring(1), line).entryName, gameVarScoreboard);
				tempStr += " "
				continue;
			}
			tempStr += str + " "
		}
		if(tellraw !== undefined){
			if(tempStr !== "") tellraw.add("text", tempStr);
			log.add("Info", `Log contained game variable so it will be logged in game during runtime instead.`, line);
			log.info++;
			console.log(`[${current.file.relPath}][${line.line}] Log contained game variable so it will be logged in game during runtime instead.`);
			current.file.functionOutput += tellraw.build() + "\n";
			current.file.outputLines++;
		}else{
			console.log(`[${current.file.relPath}][${line.line}] ${tempStr}`);
		}
	})

	// Compiling
	function processInstructionArray(arr) {
		let endsToSkip = 0;
		for (let line of arr) {
			// Skip comments
			if (line[0] === "#") continue;
			// Error on unknown instructions
			const instruct = instructions[line[0]]
			if (instruct === undefined){
				throw new MCFSError("User Error", `Unknown instruction "${line[0]}"`, line)
			}

			// If we are scoping, add it to the current scope
			if (current.file.scopes.length !== 1) {
				if(instruct.doesScope === true){
					endsToSkip++
				}

				// If we reach an end instruct and we arent skipping anymore execute the end
				if(line[0] === "end"){
					if(endsToSkip === 0){
						instructions[line[0]].onCall(line, current.scope)
						continue;
					}else{
						endsToSkip--;
					}
				}

				// Check if the scope wants to collect it or run it
				if (current.scope.collectInstructions === true){
					current.scope.contents.push(line);
					continue;
				}
			}

			// We arent scoping or we arent collecting, run the instruction
			if (instruct) {
				if (instruct.doesScope === true) {
					new Scope(instruct, line.line);
				}
				instructions[line[0]].onCall(line, current.scope);
			}
		}
	}

	function lexFile(fileContent) {
		const lexedOutput = [];

		// Get the line of code and clean it up
		for (let i = 0, iStart = 0; i < fileContent.length; i++) {
			// Detect when we get to a ;, \n, or the end of a file. If its the latter two increment file.srcLine too
			if (fileContent[i] === ";" || fileContent[i] === "\n" || i === fileContent.length - 1) {
				const line = fileContent.substring(
					iStart, i + (i === fileContent.length - 1 && fileContent[i] !== ";" ? 1 : 0) // We need to go one more index at the end of files if it doesnt end in a ;
				).trim().replaceAll("\t", "").replaceAll("\r", "");
				if (line !== "") compileLine(line);
				if(fileContent[i] === "\n" || i === fileContent.length - 1) current.file.srcLine++
				iStart = i + 1;
			}
		}
		// Convert that line of code to a lexed array then add it to the output
		function compileLine(line) {
			const lineArr = [];
			for (let i = 0, lastSpace = 0; i < line.length; i++) {
				if (line[i] === " " || i === line.length - 1) {
					lineArr.push(line.substring(i + (i === line.length - 1 ? 1 : 0), lastSpace)); // We also need to go one more index at the end of lines
					lastSpace = i + 1;
				}
			}
			lineArr.line = current.file.srcLine;
			lexedOutput.push(lineArr);
		}
		return lexedOutput
	}

	function genFunctionOutput(lexedArray) {
		new Scope({onScopeEnd:function(scope){
			
		}})
		processInstructionArray(lexedArray, true);

		if (current.file.scopes.length > 1) {
			throw new MCFSError("User Error", "Unanswered scope instruction");
		}
		if (current.file.scopes.length < 1) {
			throw new MCFSError("Compiler Error", "Missing file scope (there should be one scope left upon compiling a file)")
		}
		current.file.scopes.pop().instruction.onScopeEnd(current.scope)
		current.scope.discard();
		current.scope = current.file.scopes[current.file.scopes.length-1];
		return files.pop();
	}

	function compileFile(filePath) {
		if(fs.existsSync(srcPath+filePath) === false) throw new MCFSError("User Error", `Tried to compile nonexistant file (${filePath})`);
		new File(path.resolve(srcPath + filePath), filePath)

		let file = genFunctionOutput(lexFile(fs.readFileSync(srcPath + filePath, { encoding: "utf8" })));
		let baseName = filePath.replace(".mcfs", "");

		let lastFile = "";
		let fileContent = "";
		let lines = 0;
		const lineLimit = 9999
		let iStart = 0;
		let i = 0;
		while(i < file.functionOutput.length){
			// Gather lineLimit amount of lines
			if(file.functionOutput[i] === "\n"){
				fileContent += file.functionOutput.substring(iStart, i);
				iStart = (lines===lineLimit-1 ? i+1 : i);
				lines++
			}
			// When we reach lineLimit or the end of the file
			if (lines === lineLimit || i === file.functionOutput.length - 1){
				if(!lastFile){
					fs.writeFileSync(`${buildPath}functions/${baseName}.mcfunction`, fileContent, "utf8")
					lastFile = baseName;
				}else{
					let name = `${baseName}-${genCode()}`
					let structureName = genCode();
					fs.writeFileSync(`${buildPath}functions/${name}.mcfunction`, fileContent, "utf8")
					fs.writeFileSync(`${buildPath}structures/${structureName}.mcstructure`, generateCommandBlock(`function ${name.substring(2)}`));
					fs.appendFileSync(`${buildPath}functions/${lastFile}.mcfunction`, `\nstructure load "${structureName}" ~ -64 ~`, "utf8")
					lastFile = name
				}
				lines = 0;
				fileContent = "";
			}
			i++
		}
	}
	compileFile("./main.mcfs");

	// Finish
	console.log(`Building finished in ${(Date.now()-buildStart)/1000}s`)
	log.content += `[${(new Date).toLocaleString()}] Building finished in ${(Date.now() - buildStart) / 1000}s`
	log.write()
}