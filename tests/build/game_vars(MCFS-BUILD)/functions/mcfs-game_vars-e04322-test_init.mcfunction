scoreboard objectives add mcfs-game_vars-e04322 dummy
scoreboard players add init mcfs-game_vars-e04322 0
execute if score init mcfs-game_vars-e04322 matches 0 run function mcfs-game_vars-e04322-run_init
