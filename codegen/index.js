function genCode() {
	let str = `${performance.now()}`;
	str = str.substring(str.length - 5);
	str += Math.random() * 1000 | 0;
	str += "0".repeat(8 - str.length);
	return Number(str).toString(16);
}

export {genCode}