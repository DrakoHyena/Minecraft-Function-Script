scoreboard players set var0 mcfs-game_vars-e04322-vars 0
scoreboard players set var1 mcfs-game_vars-e04322-vars 1
scoreboard players operation var0 mcfs-game_vars-e04322-vars += var1 mcfs-game_vars-e04322-vars
scoreboard players operation var0 mcfs-game_vars-e04322-vars += var1 mcfs-game_vars-e04322-vars
scoreboard players operation var0 mcfs-game_vars-e04322-vars += var1 mcfs-game_vars-e04322-vars
scoreboard players operation var0 mcfs-game_vars-e04322-vars += var1 mcfs-game_vars-e04322-vars
scoreboard players operation var0 mcfs-game_vars-e04322-vars += var1 mcfs-game_vars-e04322-vars
tellraw @a {"rawtext":[{"text":"§7[./main.mcfs][7] "},{"text":"Game variable: "},{"score":{"name":"var0","objective":"mcfs-game_vars-e04322-vars"}},{"text":" | Compiler variable: this is a compiler variable"}]}