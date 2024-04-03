import * as fs from "node:fs";
import { generateCommandBlock } from "./coder.js";

fs.writeFileSync(`C:/Users/drako/Desktop/demo/${Date.now()}.mcstructure`, generateCommandBlock("function 1"));