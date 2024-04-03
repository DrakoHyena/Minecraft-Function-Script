async function main() {
	// Loop through all the arguments
	const args = process.argv
	for (let i = 0; i < args.length; i++) {
		// Get the arguments
		let arg = args[i];
		if (arg.startsWith("--") === false) continue;
		arg = arg.substring(2);

		switch (arg) {
			case "init":
				if (!args[i + 1] || !args[i+2]){
					return console.log("No name or description provided. (--init \"<name>\" \"<description>\")");
				}
				(await import("./procedures/init.js")).main(args[i + 1], args[i+2]);
			return;
			case "build":
				if (!args[i+1]){
					return console.log("No project specified (--build \"<project name>)\"");
				}
				(await import("./procedures/build.js")).main(args[i+1])
			return;
		}
	}

	console.log("The provided argument(s) are non-existant or invalid")
}
main();