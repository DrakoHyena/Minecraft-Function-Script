scoreboard objectives add mcfs-comp_vars-48a14a5 dummy
scoreboard players add init mcfs-comp_vars-48a14a5 0
execute if score init mcfs-comp_vars-48a14a5 matches 0 run function mcfs-comp_vars-48a14a5-run_init
