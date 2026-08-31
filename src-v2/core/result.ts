export type Result<Value, ErrorValue> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly error: ErrorValue }
