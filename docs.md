# Minecraft Function Script (MCFS) Documentation
## File Format
An mcfs file is simpily just a regular text file with its extension changed. All text within mcfs files should but UTF-8.

## File Structure
Every mcfs project should contain a main.mcfs in the root of the project. This is where the compilier starts when building your project.
Only files that are imported into main.mcfs will be built.

## Code Format
Every command, line, block, token, chunk or whatever you may call it must end with a semicolon.
Spaces, tabs, and linebreaks that come before or after a line of code are ignored, spaces in the middle of lines are not.
The example below shows every one of these quirks in effect.
```mcfs
# This is a comment;

if (true) {
			command say hello!;
};

command summon chicken; command kill @e[type="chicken"];

function test () {
	command summon pig;
};
```

## Code Commands
### \# `<text>`
A comment. Does not get included in the generated mcfunction file.

### mccmd `<minecraft command>`
Directly includes `<minecraft commad>` into the generated mcfunction file