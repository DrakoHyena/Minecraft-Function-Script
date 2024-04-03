import * as fs from "node:fs";
const buf = fs.readFileSync("./mcstructure/commandBlock.mcstructure");

class ArrayBufferDecoder {
	constructor(buffer) {
		this.bytesUsed = 0;
		this.buffer = buffer;
	}
	getInt8() {
		this.bytesUsed += 1;
		return this.buffer.readInt8(this.bytesUsed - 1);
	}
	getUint8() {
		this.bytesUsed += 1;
		return this.buffer.readUint8(this.bytesUsed - 1);
	}
	getInt16() {
		this.bytesUsed += 2;
		return this.buffer.readInt16LE(this.bytesUsed - 2);
	}
	getUint16() {
		this.bytesUsed += 2;
		return this.buffer.readUint16LE(this.bytesUsed - 2);
	}
	getInt32() {
		this.bytesUsed += 4;
		return this.buffer.readInt32LE(this.bytesUsed - 4);
	}
	getUint32() {
		this.bytesUsed += 4;
		return this.buffer.readUint32LE(this.bytesUsed - 4);
	}
	getFloat32() {
		this.bytesUsed += 4;
		return this.buffer.readFloatLE(this.bytesUsed - 4);
	}
	getFloat64() {
		this.bytesUsed += 8;
		return this.buffer.readDoubleLE(this.bytesUsed - 8);
	}
	getBigInt64() {
		this.bytesUsed += 8;
		return this.buffer.readBigInt64LE(this.bytesUsed - 8);
	}
	getBigUint64() {
		this.bytesUsed += 8;
		return this.buffer.readBigUint64LE(this.bytesUsed - 8);
	}
}

const decodeMcStructure = (() => {
	function decodeValue(dv, typeToDecode) {
		switch (typeToDecode) {
			case "end":
			case 0: {
				return null;
			} break;

			case "byte":
			case 1: {
				return dv.getInt8();
			} break;

			case "short":
			case 2: {
				return dv.getInt16();
			} break;

			case "integer":
			case 3: {
				return dv.getInt32();
			} break;

			case "long":
			case 4: {
				return dv.getBigInt64();
			} break;

			case "float":
			case 5: {
				return dv.getFloat32();
			}

			case "string":
			case 8: {
				const strLength = dv.getUint16();
				console.log(strLength)
				let str = "";
				for (let i = 0; i < strLength; i++) {
					str += String.fromCharCode(dv.getInt8());
				}
				return str;
			} break;

			case "list":
			case 9: {
				const arr = [];
				const type = dv.getInt8();
				const listLength = dv.getInt32();
				for (let i = 0; i < listLength; i++) {
					arr.push(decodeValue(dv, type));
				}
				return arr;
			} break;

			case "compound":
			case 10: {
				const obj = {};
				let type;
				while ((type = dv.getInt8()) !== 0) {
					let str = decodeValue(dv, "string");
					if(str === "Command"){
						const command = "say a";

						const buf = Buffer.allocUnsafe(command.length+2);
						buf.writeUint16LE(command.length, 0);
						buf.write(command, 2, "utf8");

						dv.buffer = Buffer.concat([dv.buffer.subarray(0,dv.bytesUsed), buf, dv.buffer.subarray(dv.bytesUsed+2)]); // bytesUsed SHOULD be 311
					}
					obj[str] = decodeValue(dv, type);
				}
				return obj;
			} break;

			default: {
				console.error("Unknown NBT type", typeToDecode);
			} break;
		}
	}

	return function (buf) {
		let dv = new ArrayBufferDecoder(buf);
		dv.bytesUsed += 3; // Skip root
		return decodeValue(dv, "compound");
	}
})();

console.log(decodeMcStructure(buf).structure.palette.default.block_position_data);