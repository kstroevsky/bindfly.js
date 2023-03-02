import { RGBAToHexA } from './color-helpers';
import { TOUCH_EXPIRATION } from '../constants';
import type { TValues, IProperty, IVectorsForIntersect } from '../types';

export const trivialOne = <T>(value: T): T => value;

export const isLayoutActive = (start: number, end: number): boolean =>
	!!end && end - start >= TOUCH_EXPIRATION;

export const getMediaMatches = (query: string): boolean =>
	typeof window !== 'undefined' && window.matchMedia(query).matches;

export const parametersToString = (
	value: TValues<IProperty> | TValues<IProperty>[]
): string => {
	switch (true) {
		case Array.isArray(value):
			return (value as IProperty[keyof IProperty][])
				.map(parametersToString)
				.join(', ');
		case /rgb/g.test(value as string):
			return RGBAToHexA(value as string);
		case typeof value === 'boolean':
		default:
			return value?.toString() || '';
	}
};

export const isVectorsIntersected = ({
	a,
	b,
	c,
	d,
	p,
	q,
	r,
	s,
}: IVectorsForIntersect): boolean => {
	const det = (c - a) * (s - q) - (r - p) * (d - b);
	if (det === 0) return false;
	else {
		const lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
		const gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
		return lambda > 0 && lambda < 1 && gamma > 0 && gamma < 1;
	}
};

export const getQueryParams = (path: string) => Object.fromEntries(path.slice(1).split('&').map(item => item.split('=')))
