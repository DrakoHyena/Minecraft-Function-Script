import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { generateCommandBlock } from "../mcstructure/coder.js";

const bhPackFolder = `${process.env.APPDATA}\\..\\Local\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang\\development_behavior_packs\\`

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
		constructor(instruction) {
			this.instruction = instruction; // The instruction associated with the scope, used for instruction.onScopeEnd
			this.contents = []; // Where instructions inside the scope are stored
			this.compilerVars = {}; // Where compiler variables ($) in the scope get stored
			this.gameVars = {}; // Where game variables(&) in the scope get stored
			scopes.push(this); // Adding our scope to the scope stack
		}
		getCompilerVarList(variable){
			for (let i = scopes.length-1; i > -1; i--){
				if(scopes[i].compilerVars[variable] !== undefined){
					return scopes[i].compilerVars
				}
			}
			throw new Error(`Compiler variable "${variable}" is not defined`)
		}
		getGameVarList(variable){
			for (let i = scopes.length - 1; i > -1; i--) {
				if (scopes[i].gameVars[variable]) {
					return scopes[i].gameVars
				}
			}
			throw new Error(`Game variable "${variable}" is not defined`)
		}
	}

	// Instructions
	// VAR INSTRUCTION
	new Instruction("var", (line, scope)=>{
		const type = line[1].substring(0, 1);
		const name = line[1].substring(1);
		const operation = line[2];
		const value = line[3];
		let numVal = 0;
		switch(type){
			case "$":
				switch(operation){
					case "=":
						numVal = Number(value);
						if(isNaN(numVal)){
							scope.compilerVars[name] = value;
						}else{
							scope.compilerVars[name] = numVal;
						}
					break;
					case "+":
						numVal = Number(value);
						if(isNaN(numVal)){
							scope.getCompilerVarList(name)[name] += value;
						}else{
							scope.getCompilerVarList(name)[name] += numVal;
						}
					break;
					case "-":
					break;
					case "*":
					break;
					case "^":
					break;
					case "%":
					break;
					default:
						throw new Error(`Unknown variable operation "${operation}"`);
					break;
				}
			break;
			case "&":
			break;
			default:
				throw new Error(`Unknown variable type "${type}"`);
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
		for (let i = 0; i < scope.times; i++) {
			processInstructionArray(JSON.parse(JSON.stringify(scope.contents)))
		}
		mcfunctOutput = scope.storedMcfunctOutput + mcfunctOutput;
	})

	// END INSTRUCTION
	new Instruction("end", (line, scope)=>{
		if (scopes.length === 0) {
			throw new Error("\"end\" instruction called while no scope is active");
		}
		scopes.pop().instruction.onScopeEnd(scope);
	})

	// Compiling
	function processInstructionArray(arr) {
		for (let line of arr) {
			// Skip comments
			if (line[0] === "#") continue;
			// Error on unknown instructions
			const instruct = instructions[line[0]]
			if (instruct === undefined){
				throw new Error(`Uknown instruction "${line[0]}" (${line.join(" ")})`)
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
					new Scope(instruct);
				}
				instructions[line[0]].onCall(line, scopes[scopes.length-1]);
			}
		}
	}

	function lexFile(fileContent) {
		const lexedOutput = [];

		// Get the line of code and clean it up
		for (let i = 0, iStart = 0; i < fileContent.length; i++) {
			if (fileContent[i] === ";" || fileContent[i] === "\r" || fileContent[i] === "\n" || i === fileContent.length - 1) {
				const line = fileContent.substring(
					iStart, i + (i === fileContent.length - 1 && fileContent[i] !== ";" ? 1 : 0) // We need to go one more index at the end of files if it doesnt end in a ;
				).trim().replaceAll("\t", "");
				if (line !== "") compileLine(line);
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
			lexedOutput.push(lineArr);
		}
		return lexedOutput
	}

	function genMcFunctOutput(lexedArray) {
		new Scope({onScopeEnd:function(scope){
			
		}})
		processInstructionArray(lexedArray);

		if (scopes.length > 1) {
			throw new Error("Unanswered scope instruction");
		}
		if (scopes.length < 1) {
			throw new Error("Missing file scope (there should be one scope left upon compiling a file)")
		}
		scopes.pop().instruction.onScopeEnd(scopes[scopes.length-1])
	}

	function compileFile(filePath) {
		if(fs.existsSync(srcPath+filePath) === false) throw new Error(`Tried to compile nonexistant file (${filePath})`);
		
		genMcFunctOutput(lexFile(fs.readFileSync(srcPath + filePath, { encoding: "utf8" })));

		fs.writeFileSync(`${buildPath}functions/${filePath.replace(".mcfs","")}.mcfunction`, mcfunctOutput, "utf-8");
	}
	compileFile("./main.mcfs");

	// Finish
	console.log("Building finished.")
}