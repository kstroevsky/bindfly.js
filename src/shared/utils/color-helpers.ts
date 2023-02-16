export const RGBAToHexA = (
	rgbaString: string,
	forceRemoveAlpha = false
): string =>
	'#' +
	rgbaString
		.replace(/^rgba?\(|\s+|\)$/g, '')
		.split(',')
		.slice(0, 3 + +forceRemoveAlpha)
		.map((string, index) => {
			const number = parseFloat(string);

			return (index === 3 ? Math.round(number * 255) : number).toString(16);
		})
		.reduce((acc, item) => acc + (item.length === 1 ? `0${item}` : item), '');

export const RGBAToNegative = (rgbaString: string): string =>
	`${rgbaString.match(/^rgba?/g)![0]}(${rgbaString
		.match(/[0-9]+/g)!
		.map((x, i) => (i < 3 ? 255 - parseInt(x) : x))
		.join(',')})`;

export const getAlpha = (color: string) => {
	const match = color.match(
		/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d+(?:\.\d+)?)\)/
	);

	return match ? +match[4] : 0;
};

export const changeAlpha = (color: string, newAlpha: number) => {
	const match = color.match(
		/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d+(?:\.\d+)?)\)/
	);

	if (!match) return color;
	const [, red, green, blue] = match;

	return `rgba(${red}, ${green}, ${blue}, ${newAlpha})`;
};

export const generateColorsByCount = (count: number) =>
	Array.from(new Array(count)).map((_, i) => {
		const frequency = 5 / count;
		return `rgba(${Math.floor(
			Math.sin(frequency * i + 0) * 127 + 128
		)}, ${Math.floor(Math.sin(frequency * i + 2) * 127 + 128)}, ${Math.floor(
			Math.sin(frequency * i + 4) * 127 + 128
		)}, 1)`;
	});
