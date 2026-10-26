/** How many choices a row shows before the rest fold behind "more". */
export const SHOWN = 8;

/**
 * The choices a row shows. A long row folds after SHOWN, but the one picked
 * always stays visible, even when it sits in the folded part.
 */
export function visibleOptions(options: readonly string[], value: string, expanded: boolean, limit = SHOWN): { shown: string[]; hidden: number } {
  if (expanded || options.length <= limit + 1) return { shown: [...options], hidden: 0 };
  const shown = options.slice(0, limit);
  if (options.includes(value) && !shown.includes(value)) shown.push(value);
  return { shown, hidden: options.length - shown.length };
}

/** True when the value is the user's own words rather than one of the choices. */
export const isCustom = (options: readonly string[], value: string) => value.trim() !== "" && !options.includes(value);
