import * as fs from "node:fs";
const structBuf = fs.readFileSync("./mcstructure/commandBlock.mcstructure");

function generateCommandBlock(command){
	const buf = Buffer.allocUnsafe(command.length + 2);
	buf.writeUint16LE(command.length, 0);
	buf.write(command, 2, "utf8");
	return Buffer.concat([structBuf.subarray(0, 311), buf, structBuf.subarray(313)]);
}

export { generateCommandBlock };