async function main() {
	// Loop through all the arguments
	const args = [];
	const flags = [];
	const inputs = [];
	process.argv = process.argv.splice(2)
	for (let arg of process.argv){
		if(arg.startsWith("--")){
			args.push(arg);
		}else if(arg.startsWith("-")){
			flags.push(arg);
		}else{
			inputs.push(arg);
		}
	}
	for (let i = 0; i < args.length; i++) {
		// Get the arguments
		let arg = args[i];
		arg = arg.substring(2);

		switch (arg) {
			case "init":
				if (!inputs[0] || !inputs[1]){
					return console.log("No name or description provided. (--init \"<name>\" \"<description>\")");
				}
				(await import("./procedures/init.js")).main(inputs, flags);
			return;
			case "build":
				if (!inputs[0]){
					return console.log("No project specified (--build \"<project name>)\"");
				}
				(await import("./procedures/build.js")).main(inputs, flags)
			return;
			case "help":
				console.log(`
				--init
					arguments: "project name", "project description"
					flags: -random -test
					ex: node cli.js --init "test" "A testing project"
				--build
					arguments: "project name"
					flags: -v -random -test
					ex: node cli.js --build "test"
				`.replace(/(\n)\s+/g, '$1'))
			break;
		} 
	}

	console.log("The provided argument(s) are non-existant or invalid");
	console.log("try using --help")
}
main();