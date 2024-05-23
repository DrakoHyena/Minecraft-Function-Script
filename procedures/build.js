import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateCommandBlock } from "../mcstructure/coder.js";
import { pathToFileURL } from "node:url";
import { escape } from "node:querystring";

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
	fs.writeFileSync(buildPath + "!!READ_ME!!.txt", "## WARNING\nMODIFICATIONS TO ANYTHING IN THIS FOLDER *WILL* BE LOST. TO MAKE CHANGES PLEASE EDIT THE SRC FOLDER.\n\n## INFO\nThis behavior pack was generated using Minecraft Function Script (MCFS). Learn more about the project at https://github.com/DrakoHyena/Minecraft-Function-Script", "utf8")

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
		"MCFS Source": "https://github.com/DrakoHyena/Minecraft-Function-Script"
	}
}`	);

	// Make function directory
	fs.mkdirSync(buildPath+"functions")

	// Compile Functions and classes
	let mcfunctOutput = "";
	const instructions = {};
	const scopes = [];
	const file = {
		path: "",
		relPath: "",
		line: 1
	}

	class MCFSError extends Error {
		constructor(type, message, line) {
			super(message);

			this.name = type;
			const stackArr = this.stack.split("\n");
			this.stack = stackArr.shift()+"\n";
			this.stack += `    at ${pathToFileURL(file.path)}:${line?.line||scopes[scopes.length-1].startingLine}:0`
			if(line) this.stack += `\nLINE IN MCFS FILE\n    ${line.join(" ")}`
			if (flags.includes("-v") === true) {
				this.stack += "\nCOMPILER STACK TRACE\n"
				this.stack += stackArr.join("\n")
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
	class Scope {
		constructor(instruction, startingLine) {
			this.instruction = instruction; // The instruction associated with the scope, used for instruction.onScopeEnd
			this.contents = []; // Where instructions inside the scope are stored
			this.compilerVars = {}; // Where compiler variables ($) in the scope get stored
			this.gameVars = {}; // Where game variables(&) in the scope get stored
			this.startingLine = startingLine; // The line where the scope starts, used in errors
			scopes.push(this); // Adding our scope to the scope stack
		}
		getCompilerVarList(variable, line){
			for (let i = scopes.length-1; i > -1; i--){
				if(scopes[i].compilerVars[variable] !== undefined){
					return scopes[i].compilerVars
				}
			}
			throw new MCFSError("User Error", `Compiler variable "${variable}" is not defined`, line)
		}
		getGameVarList(variable, line){
			for (let i = scopes.length - 1; i > -1; i--) {
				if (scopes[i].gameVars[variable]) {
					return scopes[i].gameVars
				}
			}
			throw new MCFSError("User Error", `Game "${variable}" is not defined`, line)
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
			case "$":
				switch(operation){
					case "=":
						// Equal: nothing
						if(value === undefined){
							throw new MCFSError("User Error", "Cannot set variable to nothing", line);
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
			case "&":
			break;
			default:
				throw new MCFSError("User Error", `Unknown variable type "${type}"`, line);
			break;
		}
	});

	// CMD INSTRUCTION
	new Instruction("cmd", (line, scope)=>{
		line.shift();
		
		for(let str of line){
			if(str[0] === "$"){
				str = scope.getCompilerVarList(str.substring(1))[str.substring(1)]
			}
			mcfunctOutput += str + " "
		}
		mcfunctOutput += "\n";
	})

	// REPEAT INSTRUCTION
	new Instruction("repeat", function(line, scope){
		scope.storedMcfunctOutput = mcfunctOutput;
		scope.times = Number(line[1]);
		mcfunctOutput = "";
	}, function(scope){
		// We do it once outside and count lines so debugging works
		for (let i = 0; i < scope.times; i++) {
			processInstructionArray(structuredClone(scope.contents))
		}
		mcfunctOutput = scope.storedMcfunctOutput + mcfunctOutput;
	})

	// END INSTRUCTION
	new Instruction("end", (line, scope)=>{
		if (scopes.length === 0) {
			throw new MCFSError("User Error", "\"end\" instruction called while no scope is active", line);
		}
		scopes.pop().instruction.onScopeEnd(scope);
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
		console.log(`[${file.relPath}][${line.line}] ${output}`);
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
			if (scopes.length !== 1 && line[0] !== "end" && !instruct.doesScope) {
				scopes[scopes.length - 1].contents.push(line);
				continue;
			}
			// Activate regular instructions
			if (instruct) {
				if (instruct.doesScope === true) {
					new Scope(instruct, line.line);
				}
				instructions[line[0]].onCall(line, scopes[scopes.length-1]);
			}
		}
	}

	function lexFile(fileContent) {
		const lexedOutput = [];

		// Get the line of code and clean it up
		for (let i = 0, iStart = 0; i < fileContent.length; i++) {
			// Detect when we get to a ;, \n, or the end of a file. If its the latter two increment file.line too
			if (fileContent[i] === ";" || fileContent[i] === "\n" || i === fileContent.length - 1) {
				const line = fileContent.substring(
					iStart, i + (i === fileContent.length - 1 && fileContent[i] !== ";" ? 1 : 0) // We need to go one more index at the end of files if it doesnt end in a ;
				).trim().replaceAll("\t", "").replaceAll("\r", "");
				if (line !== "") compileLine(line);
				if(fileContent[i] === "\n" || i === fileContent.length - 1) file.line++
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
			lineArr.line = file.line;
			lexedOutput.push(lineArr);
		}
		return lexedOutput
	}

	function genMcFunctOutput(lexedArray) {
		new Scope({onScopeEnd:function(scope){
			
		}})
		processInstructionArray(lexedArray, true);

		if (scopes.length > 1) {
			throw new MCFSError("User Error", "Unanswered scope instruction");
		}
		if (scopes.length < 1) {
			throw new MCFSError("Compiler Error", "Missing file scope (there should be one scope left upon compiling a file)")
		}
		scopes.pop().instruction.onScopeEnd(scopes[scopes.length-1])
	}

	function compileFile(filePath) {
		if(fs.existsSync(srcPath+filePath) === false) throw new MCFSError("User Error", `Tried to compile nonexistant file (${filePath})`);
		file.path = path.resolve(srcPath+filePath)
		file.relPath = filePath
		genMcFunctOutput(lexFile(fs.readFileSync(srcPath + filePath, { encoding: "utf8" })));

		fs.writeFileSync(`${buildPath}functions/${filePath.replace(".mcfs","")}.mcfunction`, mcfunctOutput, "utf-8");
	}
	compileFile("./main.mcfs");

	// Finish
	console.log("Building finished.")
}