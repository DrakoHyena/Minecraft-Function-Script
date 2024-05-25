import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateCommandBlock } from "../mcstructure/coder.js";
import { genCode } from "../codegen/index.js";
import { pathToFileURL } from "node:url";
import { get } from "node:http";

let bhPackFolder = `${process.env.APPDATA}\\..\\Local\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang\\development_behavior_packs\\`

export function main(inputs, flags) {
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
		warnings: 0
	}
	log.write = function() {
		if (fs.existsSync(buildPath)) {
			fs.writeFileSync(buildPath + "build_log.txt", log.content, "utf8")
			console.log(`Build logs written to build_log.txt\n- Warnings: ${log.warnings}`)
		}else{
			console.log("Failed to write build logs due to the buildPath not existing");
		}
	}

	const files = [];
	const gameVarScoreboard = `mcfs-${projectDetails.name}-${projectDetails.projectCode}-vars`

	class MCFSError extends Error {
		constructor(type, message, line) {
			super(message);

			// Set up the error
			this.name = type;
			const stackArr = this.stack.split("\n");
			this.stack = stackArr.shift()+"\n";
			this.stack += `    at ${pathToFileURL(current.file.path)}:${line?.line||current.scope.startingLine}:0`
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
			this.compilerVars = {}; // Where compiler variables ($) in the scope get stored
			this.gameVars = {}; // Where game variables(&) in the scope get stored
			this.startingLine = startingLine; // The line where the scope starts, used in errors
			current.file.scopes.push(this); // Adding our scope to the scope stack
			current.scope = this;
		}
		getCompilerVarList(variable, line) {
			for (let i = current.file.scopes.length - 1; i > -1; i--) {
				if (current.file.scopes[i].compilerVars[variable] !== undefined) {
					return current.file.scopes[i].compilerVars
				}
			}
			throw new MCFSError("User Error", `Compiler variable "${variable}" is not defined`, line)
		}
		getGameVarList(variable, line) {
			for (let i = current.file.scopes.length - 1; i > -1; i--) {
				if (current.file.scopes[i].gameVars[variable]) {
					return current.file.scopes[i].gameVars
				}
			}
			throw new MCFSError("User Error", `Game "${variable}" is not defined`, line)
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

						// Equal: string
						tempVar = line.slice(3).join(" ");
						if (tempVar.startsWith("\"") && tempVar.endsWith("\"")){
							scope.compilerVars[name] = tempVar.substring(1, tempVar.length-1);
							return
						}

						// Equal: number
						tempVar = Number(tempVar.replaceAll(",", ""));
						if (isNaN(tempVar)){
							throw new MCFSError("User Error", "Missing quotes when defining string", line);
						}else{
							scope.compilerVars[name] = tempVar;
						}
					break;
					case "+":
						tempVar = Number(value);
						if (isNaN(tempVar)){
							// Add: variable
							if (value[0] === "$"){
								tempVar = value.substring(1);
								scope.getCompilerVarList(name, line)[name] += scope.getCompilerVarList(tempVar, line)[tempVar]
							}else{ // Add: string
								scope.getCompilerVarList(name, line)[name] += value.substring(1, value.length - 1);
							}
						}else{ // Add: number
							scope.getCompilerVarList(name, line)[name] += tempVar;
						}
					break;
					case "-":
						tempVar = scope.getCompilerVarList(name, line)[name];
						if (typeof tempVar !== "number"){
							throw new MCFSError("User Error", `Attempted to subtract from a non-numeric variable (${name}: ${tempVar})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)){
							throw new MCFSError("User Error", `Attempted to subtract using a non-numeric value (${value})`, line)
						}else{
							scope.getCompilerVarList(name, line)[name] -= value;
						}
					break;
					case "*":
						tempVar = scope.getCompilerVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to multiply a non-numeric variable (${name}: ${variable})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to multiply using a non-numeric value (${value})`, line)
						} else {
							scope.getCompilerVarList(name, line)[name] *= value;
						}
					break;
					case "/":
						tempVar = scope.getCompilerVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to divide a non-numeric variable (${name}: ${variable})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to divide using a non-numeric value (${value})`, line)
						} else {
							scope.getCompilerVarList(name, line)[name] /= value;
						}
					break;
					case "^":
						tempVar = scope.getCompilerVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to exponentiate a non-numeric variable (${name}: ${variable})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to exponentiate using a non-numeric value (${value})`, line)
						} else {
							scope.getCompilerVarList(name, line)[name] **= value;
						}
					break;
					case "%":
						tempVar = scope.getCompilerVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to modulate a non-numeric variable (${name}: ${variable})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to modulate using a non-numeric value (${value})`, line)
						} else {
							scope.getCompilerVarList(name, line)[name] %= value;
						}
					break;
					default:
						throw new MCFSError("User Error", `Unknown variable operation "${operation}"`, line);
					break;
				}
			break;
			// Game variables
			case "&": // TODO: Finish game variables
				// TODO: Make it so variables are assigned to a list so they can be resued
				switch (operation) {
					case "=":
						// Equal: nothing
						if (value === undefined) {
							throw new MCFSError("User Error", "Cannot set a game variable to nothing", line);
						}

						tempVar = Number(line.slice(3).join(" ").replaceAll(",", ""));
						if (isNaN(tempVar)) { // Equal: string
							throw new MCFSError("User Error", "Game variables can only be numbers", line);
						} else {// Equal: number
							if (tempVar > 2147483647) throw new MCFSError("User Error", "Game variables cannot be higher than 2147483647")
							if (tempVar < -2147483648) throw new MCFSError("User Error", "Game variables cannot be lower than -2147483648")
							scope.gameVars[name] = tempVar;
							current.file.functionOutput += `scoreboard players set ${name} ${gameVarScoreboard} ${tempVar}\n`;
							current.file.outputLines++;
						}
						break;
					case "+":
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							// Add: variable
							if (value[0] === "$") {
								tempVar = value.substring(1);
								scope.getCompilerVarList(name, line)[name] += scope.getCompilerVarList(tempVar, line)[tempVar]
							} else { // Add: string
								scope.getCompilerVarList(name, line)[name] += value.substring(1, value.length - 1);
							}
						} else { // Add: number
							scope.getCompilerVarList(name, line)[name] += tempVar;
						}
						break;
					case "-":
						tempVar = scope.getCompilerVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to subtract from a non-numeric variable (${name}: ${tempVar})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to subtract using a non-numeric value (${value})`, line)
						} else {
							scope.getCompilerVarList(name, line)[name] -= value;
						}
						break;
					case "*":
						tempVar = scope.getCompilerVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to multiply a non-numeric variable (${name}: ${variable})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to multiply using a non-numeric value (${value})`, line)
						} else {
							scope.getCompilerVarList(name, line)[name] *= value;
						}
						break;
					case "/":
						tempVar = scope.getCompilerVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to divide a non-numeric variable (${name}: ${variable})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to divide using a non-numeric value (${value})`, line)
						} else {
							scope.getCompilerVarList(name, line)[name] /= value;
						}
						break;
					case "^":
						tempVar = scope.getCompilerVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to exponentiate a non-numeric variable (${name}: ${variable})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to exponentiate using a non-numeric value (${value})`, line)
						} else {
							scope.getCompilerVarList(name, line)[name] **= value;
						}
						break;
					case "%":
						tempVar = scope.getCompilerVarList(name, line)[name];
						if (typeof tempVar !== "number") {
							throw new MCFSError("User Error", `Attempted to modulate a non-numeric variable (${name}: ${variable})`, line)
						}
						tempVar = Number(value);
						if (isNaN(tempVar)) {
							throw new MCFSError("User Error", `Attempted to modulate using a non-numeric value (${value})`, line)
						} else {
							scope.getCompilerVarList(name, line)[name] %= value;
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
				str = scope.getCompilerVarList(str.substring(1))[str.substring(1)]
			}
			current.file.functionOutput += str + " "
		}
		current.file.functionOutput += "\n";
		current.file.outputLines++;
	})

	// REPEAT INSTRUCTION
	new Instruction("repeat", function(line, scope){
		scope.storedOutput = current.file.functionOutput;
		scope.times = Number(line[1]);
		current.file.functionOutput = "";
	}, function(scope){
		// We do it once outside and count lines so debugging works
		for (let i = 0; i < scope.times; i++) {
			processInstructionArray(structuredClone(scope.contents))
		}
		current.file.functionOutput = scope.storedOutput + current.file.functionOutput;
	})

	// END INSTRUCTION
	new Instruction("end", (line, scope)=>{
		if (current.file.scopes.length === 0) {
			throw new MCFSError("User Error", "\"end\" instruction called while no scope is active", line);
		}
		current.file.scopes.pop().instruction.onScopeEnd(scope);
		current.scope = current.file.scopes[current.file.scopes.length-1]
	})

	// DEFFFUNCT INSTRUCTION
	new Instruction("deffunct", (line, scope)=>{

	}, function(scope){
		
	})

	// LOG INSTRUCTION
	new Instruction("log", (line, scope)=>{
		let output = "";
		let outputArr = line.slice(1);
		for (let str of outputArr) {
			if (str[0] === "$") {
				str = scope.getCompilerVarList(str.substring(1))[str.substring(1)]
			}
			output += str + " "
		}
		console.log(`[${current.file.relPath}][${line.line}] ${output}`);
	})

	// Compiling
	function processInstructionArray(arr) {
		for (let line of arr) {
			// Skip comments
			if (line[0] === "#") continue;
			// Error on unknown instructions
			const instruct = instructions[line[0]]
			if (instruct === undefined){
				throw new MCFSError("User Error", `Unknown instruction "${line[0]}"`, line)
			}
			// Dont activate scoped or end instructions right away
			// If its the main file scope (scopes.length!==1) then we are able to just process it now
			if (current.file.scopes.length !== 1 && line[0] !== "end" && !instruct.doesScope) {
				current.scope.contents.push(line);
				continue;
			}
			// Activate regular instructions
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
				fileContent += file.functionOutput.substring(iStart, (lines===lineLimit-1 ? i-1 : i));
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
					fs.appendFileSync(`${buildPath}functions/${lastFile}.mcfunction`, `\nstructure load ${structureName} ~ -64 ~`, "utf8")
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
	console.log("Building finished")
	log.write()
}