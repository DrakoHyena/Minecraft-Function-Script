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
All values that can be applied via operations must be a string ("like this"), a boolean (true/false), a number (1,000.1), or another compiler variable.\
Compiler variables cannnot be changed (=, +, -, etc.) by game variables because game variables are calculated during run time.
Adding a string to a number, or the other way around, will just append the number to the string in it's respective order.
If you call an undefined compiler variable an error will be thrown and the build process will fail.
Here is an example:
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
###### $ Operations
The operations for compiler variables are limited to basic arithmetic.
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
- %
	- Sets the variable to the result of a modulus operation on the variable by the value
- `round <up/down/auto>`
	- Rounds the variable up or down


##### & (Game variables)
Ampersands represent in-game variables. In a nut shell, these variables are just dummy scoreboard players that are managed by MCFS. Due to minecraft's limitations the only values these variables can be are the numbers through are -2147483648 and 2147483647. The big difference between game variables and compilier variables is that game variables are calculated and stored inside of minecraft, meaning, they are able to be used dynamically in commands such as tellraw or titleraw. However, due to their uncertainty, often times, they cannot be calculated during compilation. This means game variables and compiler variables dont often mingle, look at the opeations to learn more. If you call an undefined game variable an error will be thrown and the build process will fail.
Here is an example.
TODO: MAKE THE INPUT AND OUTPUT
Input:
```mcfs
```
Output:
```mcfunction
```
Game variables have an additional option thats an operation; you can use external scoreboards.
```
- `var &example = scoreboard <selector/"value"> <scoreboard objective>`
- UNSAFE METHOD: MCFS does not validate that scoreboard or selector exists and it might cause unexpected behavior in your program
```

###### & Operations
- =
	- Sets the variable equal to the value
	- Can be set to compiler variables
	- Can be set to a player on a scoreboard
- \+
	- Adds the value to the variable
	- Can add compiler variables
- \-
	- Subtracts the value from the variable
	- Can subtract compiler variables
- \*
	- Multiplies the variable by the value
	- Can multiply by compiler variables
- \\
	- Divides the variable by the value
	- Can divide by compiler variables
- %
	- Sets the variable to the result of a modulus operation on the variable by the value

### log <value>
Logs anything in value whether its text, variables, or both in the nodejs console during compile time. Useful for debugging.

### deffunct `<name> <type><param1> <type><param2> ... <type><paramN>`
Creates a function that can be called elsewhere in the same scope.
```mcfs
function spawnGeralds $amount
	var &pigcount = 0;
	repeat $amount
		var $pigcount + 1;
		cmd summon pig Gerald;
	end
	cmd tellraw @a [{"score": &pigamount}, {"text": " Geralds(s) have been summoned"}]
end
```

### callfunct `<name> <var1> <var2> ... <varN>`
Call the specified function with the provided parameters. Each parameter must match the defined parameter's type. If an inputted value isn't a variable (like a string or number) it will be treated as a $ variable. See below for examples.
Example 1 (works):
```mcfs
var $spawnAmount = 10;
callfunct spawnGeralds $spawnAmount

# this also works because the parameter is a $ type
callfunct spawnGeralds 10
```
Example 2 (errors):
```
# This works
var &score = 100;
callfunct isHighscore &score

# This doesnt work because a & variable is expected but it gets "10" as a $ variable instead
callfunct isHighscore 10;
``` 

## callexternalfunct `<name>`
Calls the specified function via minecraft's function command. The reason this cannot be done with the cmd instruction is due to the 10,000 command limit per function. Rather than calling the function inside the mcfunction file, this will spawn in a command block which will call the function. While this does introduce a delay of 1 tick, it ensures you can use other functions from other packs and have your code work as intended.

### exportfunct `<function name> <(optional) export name>`
Allows other mcfs files to import the specified function as the export name so they can use it. If no export name is defined it will become the function name.There are two major things to note: exportfunct must be called in the same scope as the function you are trying to export, a function cannot be exported if it makes use of a variable from another scope, and lastly, a file (file1) cannot import another file (file2) if the other file (file2) also imports the first file (file1) (i.e. circular imports are not allowed). Examples are shown under importfunct.

### importfunct `<filepath relative to main.mcfs> <export name>`
Import an exported function from another mcfs file.
Example 1 (works):
a.mcfs:
```mcfs
deffunct spawnLarrys $amount
	repeat $amount
		cmd summon chicken Larry;
	end;
end;
exportfunct spawnLarrys
```
b.mcfs:
```mcfs
importfunct ./a.mcfs spawnLarrys;
callfunct spawnLarrys 5;
```
Example 2 (works):
a.mcfs:
```mcfs
deffunct spawnGerald
	cmd summon pig Larry;
end;
exportfunct spawnGerald summonPig;
```
b.mcfs:
```mcfs
importfunct ./a.mcfs summonPig;
callfunct summonPig;
```
Example 3 (errors):
a.mcfs:
```mcfs
# Notice how $message is defined outside of announceMessage and then used inside of that function
var $message = "Rah!!";
deffunct announceMessage
	cmd say $message
end;
exportfunct announceMessage;
```
Example 4 (errors):
a.mcfs:
```mcfs
# Notice how b is required in a
importfunct ./b.mcfs bar;
deffunct foo
end;
exportfunct foo;
```
b.mcfs:
```mcfs
# and how a is required in b
importfunct ./a.mcfs foo;
deffunct bar
end;
exportfunct bar;
```