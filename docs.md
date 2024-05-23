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
##### $ (Compiler variables)
Dollar signs represent compiler variables. These variables can be thought of as "macro variables" found in some other languages.
Their values are calculated during compile time and their output is put directly into the resulting mcfunction file.
All values that can be applied via operations must be a string ("like this"), a boolean (true/false), a number (1000.1), or another compiler variable.
Adding a string to a number, or the other way around, will just append the number to the string in it's respective order.
If you call an undefined compiler variable an error will be thrown and the build process will fail.
Here is an example.
Input:
```mcfs
var $counter = 0;
repeat 3
	var $counter + 1;
	cmd say counter is at: $counter;
end;
```
Output:
```mcfunction
say counter is at: 1
say counter is at: 2
say counter is at: 3
```

##### & (Game variables)
Ampersands represent in-game variables. In a nut shell, these variables are just dummy scoreboard players that are managed by MCFS. Due to minecraft's limitations the only values these variables can be are the numbers through... TODO: ADD THE NUMBERS. The big difference between game variables and compilier variables is that game variables are calculated and stored inside of minecraft, meaning, they are able to be used dynamically in commands such as tellraw or titleraw. If you call an undefined game variable an error will be thrown and the build process will fail. Here is an example.
TODO: MAKE THE INPUT AND OUTPUT
Input:
```mcfs
```
Output:
```mcfunction
```

#### Operations
- =
	- Sets the variable equal to the value
- \+
	- Adds the value to the variable
- \-
	- Subtracts the value from the variable
- \*
	- Multiplies the variable by the value
- \\
	- Divides the variable by the value
- \^
	- Exponentiates the variable by the value
	- TODO: Might be REALLY bad for game vars
- %
	- Sets the variable to the result of a modulus operation on the variable by the value

### log <value>
Logs anything in value whether its text, variables, or both in the nodejs console during compile time. Useful for debugging.
