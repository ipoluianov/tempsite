/** Shared encoding/decoding utilities for all format converters */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function bytesToBinary(bytes) {
	return Array.from(bytes).map((b) => b.toString(2).padStart(8, '0')).join(' ');
}

function binaryToBytes(str) {
	const cleaned = str.replace(/\s/g, '');
	if (!/^[01]*$/.test(cleaned)) throw new Error('Invalid binary');
	const bytes = [];
	for (let i = 0; i < cleaned.length; i += 8) {
		const chunk = cleaned.slice(i, i + 8);
		if (chunk.length === 8) bytes.push(parseInt(chunk, 2));
		else if (chunk.length > 0) throw new Error('Invalid binary length');
	}
	return new Uint8Array(bytes);
}

function bytesToOctal(bytes) {
	return Array.from(bytes).map((b) => b.toString(8).padStart(3, '0')).join(' ');
}

function octalToBytes(str) {
	const parts = str.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
	const bytes = parts.map((p) => {
		if (!/^[0-7]{1,3}$/.test(p)) throw new Error('Invalid octal');
		const n = parseInt(p, 8);
		if (n > 255) throw new Error('Invalid octal');
		return n;
	});
	return new Uint8Array(bytes);
}

function bytesToDecimal(bytes) {
	return Array.from(bytes).join(' ');
}

function decimalToBytes(str) {
	const parts = str.trim().replace(/[,;\s]+/g, ' ').split(' ').filter(Boolean);
	const bytes = parts.map((p) => {
		const n = parseInt(p, 10);
		if (isNaN(n) || n < 0 || n > 255) throw new Error('Invalid decimal');
		return n;
	});
	return new Uint8Array(bytes);
}

function bytesToHex(bytes) {
	return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(str) {
	const cleaned = str.replace(/\s/g, '').replace(/^0x/i, '');
	if (!/^[0-9a-fA-F]*$/.test(cleaned)) throw new Error('Invalid hex');
	if (cleaned.length % 2) throw new Error('Invalid hex length');
	const bytes = [];
	for (let i = 0; i < cleaned.length; i += 2) {
		bytes.push(parseInt(cleaned.slice(i, i + 2), 16));
	}
	return new Uint8Array(bytes);
}

function bytesToBase64(bytes) {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

function base64ToBytes(str) {
	const cleaned = str.trim().replace(/\s/g, '');
	if (!cleaned) return new Uint8Array(0);
	const binary = atob(cleaned);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function bytesToBase32(bytes) {
	let result = '';
	let bits = 0;
	let value = 0;
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			bits -= 5;
			result += BASE32_ALPHABET[(value >>> bits) & 31];
		}
	}
	if (bits > 0) result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
	return result;
}

function base32ToBytes(str) {
	const cleaned = str.trim().replace(/\s/g, '').toUpperCase().replace(/=+$/, '');
	if (!cleaned) return new Uint8Array(0);
	const bytes = [];
	let bits = 0;
	let value = 0;
	for (const c of cleaned) {
		const idx = BASE32_ALPHABET.indexOf(c);
		if (idx < 0) throw new Error('Invalid base32');
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			bits -= 8;
			bytes.push((value >>> bits) & 255);
		}
	}
	return new Uint8Array(bytes);
}

function bytesToBase58(bytes) {
	const alphabet = BASE58_ALPHABET;
	let leadingZeros = 0;
	for (const b of bytes) {
		if (b !== 0) break;
		leadingZeros++;
	}
	const rest = bytes.slice(leadingZeros);
	if (rest.length === 0) return '1'.repeat(leadingZeros || 1);
	let num = BigInt(0);
	for (const b of rest) num = num * 256n + BigInt(b);
	let result = '';
	while (num > 0n) {
		result = alphabet[Number(num % 58n)] + result;
		num = num / 58n;
	}
	return '1'.repeat(leadingZeros) + result;
}

function base58ToBytes(str) {
	const alphabet = BASE58_ALPHABET;
	const leadingOnes = str.match(/^1*/)?.[0]?.length ?? 0;
	const rest = str.slice(leadingOnes);
	let num = BigInt(0);
	for (const c of rest) {
		const idx = alphabet.indexOf(c);
		if (idx < 0) throw new Error('Invalid base58');
		num = num * 58n + BigInt(idx);
	}
	const bytes = [];
	while (num > 0n) {
		bytes.unshift(Number(num % 256n));
		num = num / 256n;
	}
	return new Uint8Array([...Array(leadingOnes).fill(0), ...bytes]);
}

function bytesToBase85(bytes) {
	let result = '';
	for (let i = 0; i < bytes.length; i += 4) {
		const chunk = bytes.slice(i, i + 4);
		if (chunk.length === 4 && chunk.every((b) => b === 0)) {
			result += 'z';
			continue;
		}
		let n = 0;
		for (let j = 0; j < chunk.length; j++) n = n * 256 + chunk[j];
		for (let p = 0; p < 4 - chunk.length; p++) n *= 256;
		const outLen = chunk.length + 1;
		let block = '';
		for (let k = 0; k < 5; k++) {
			block = String.fromCharCode(33 + (n % 85)) + block;
			n = Math.floor(n / 85);
		}
		result += block.slice(-outLen);
	}
	return result;
}

function base85ToBytes(str) {
	const cleaned = str.trim().replace(/\s/g, '');
	if (!cleaned) return new Uint8Array(0);
	const bytes = [];
	let i = 0;
	while (i < cleaned.length) {
		if (cleaned[i] === 'z') {
			bytes.push(0, 0, 0, 0);
			i++;
			continue;
		}
		let n = 0;
		const chunk = cleaned.slice(i, i + 5);
		if (chunk.length < 5) throw new Error('Invalid base85');
		for (let k = 0; k < 5; k++) {
			const c = chunk.charCodeAt(k);
			if (c < 33 || c > 117) throw new Error('Invalid base85');
			n = n * 85 + (c - 33);
		}
		for (let j = 3; j >= 0; j--) bytes.push((n >>> (j * 8)) & 255);
		i += 5;
	}
	return new Uint8Array(bytes);
}

const parsers = {
	base64: base64ToBytes,
	base32: base32ToBytes,
	base58: base58ToBytes,
	base85: base85ToBytes,
	binary: binaryToBytes,
	octal: octalToBytes,
	decimal: decimalToBytes,
	hex: hexToBytes,
};

const encoders = {
	base64: bytesToBase64,
	base32: bytesToBase32,
	base58: bytesToBase58,
	base85: bytesToBase85,
	binary: bytesToBinary,
	octal: bytesToOctal,
	decimal: bytesToDecimal,
	hex: bytesToHex,
};

export function convert(from, to, input) {
	const trimmed = input.trim();
	if (!trimmed) return '';
	const parse = parsers[from];
	const encode = encoders[to];
	if (!parse || !encode) throw new Error('Unknown format');
	const bytes = parse(trimmed);
	return encode(bytes);
}
