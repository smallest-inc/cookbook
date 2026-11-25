/** A unit label used mid-sentence: "The jet ski" reads as "following the jet ski". */
export function inSentence(label: string): string {
	return label.replace(/^The /, 'the ');
}
