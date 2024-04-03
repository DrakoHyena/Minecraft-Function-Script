# Defs
execute unless score tick <packname> matches 0.. run scoreboard objectives add <packname> dummy
execute unless score tick <packname> matches 0.. run scoreboard players add tick <packname> 0
execute unless score max_tick <packname> matches 0.. run scoreboard players set max_tick <packname> 2147483647

scoreboard players add tick <packname> 1