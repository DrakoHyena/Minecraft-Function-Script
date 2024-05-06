# Minecraft Function Script (MCFS) Documentation
## File Format
An mcfs file is simpily just a regular text file with its extension changed. All text within mcfs files should but UTF-8.

## File Structure
Every mcfs project should contain a main.mcfs in the root of the project. This is where the compilier starts when building your project.
Only files that are imported into main.mcfs will be built. A file named metadata should also be located in the root of the project. This
file is automatically generated upon project initialization required to build the project and 

## Code Format
Every command, line, block, token, chunk or whatever you may call it must end with a semicolon.
Spaces, tabs, and linebreaks that come before or after a line of code are ignored, spaces in the middle of lines are not.
The example below shows every one of these quirks in effect.
```mcfs
# This is a comment;

if (true);
			command say hello!;
end;

command say hi
command say this works!
command say this; command say also; command say works!

function test
	command summon pig;
end;
```

## Code Instructions
### \# `<text>`
A comment. Does not get included in the generated mcfunction file.

### cmd `<minecraft command>`
Directly includes `<minecraft commad>` into the generated mcfunction file.

### var `<type><varname> <operation> <value>`
Creates either a compiler variable or in game variable.
Ex: `var &adder = 123456`
#### Variable Types
- &
	- Compiler variable
	- Can be a string ("like this") a boolean (true/false) or a number
	- All assingments and operations are ran directly in the compiler's language of choice, in this case, javascript
- $
	- In game variable
	- Can be referenced inside tellraw/titleraw
	- Can be used to manipulate other scoreboard values
	- Can only be a number
	- All operations are ran inside minecraft
#### Operations
- =
	- Sets the variable equal to the value
- \+
	- Adds the value to the variable
- \-
	- Subtracts the value from the variable
- %
	- Sets the variable to the result of a modulus operation on the variable by the value 