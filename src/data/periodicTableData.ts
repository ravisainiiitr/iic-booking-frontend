export interface Element {
  symbol: string;
  name: string;
  atomicNumber: number;
  row: number;
  col: number;
  category: string;
}

export const periodicTableElements: Element[] = [
  // Period 1
  { symbol: "H", name: "Hydrogen", atomicNumber: 1, row: 1, col: 1, category: "nonmetal" },
  { symbol: "He", name: "Helium", atomicNumber: 2, row: 1, col: 18, category: "noble-gas" },
  
  // Period 2
  { symbol: "Li", name: "Lithium", atomicNumber: 3, row: 2, col: 1, category: "alkali-metal" },
  { symbol: "Be", name: "Beryllium", atomicNumber: 4, row: 2, col: 2, category: "alkaline-earth" },
  { symbol: "B", name: "Boron", atomicNumber: 5, row: 2, col: 13, category: "metalloid" },
  { symbol: "C", name: "Carbon", atomicNumber: 6, row: 2, col: 14, category: "nonmetal" },
  { symbol: "N", name: "Nitrogen", atomicNumber: 7, row: 2, col: 15, category: "nonmetal" },
  { symbol: "O", name: "Oxygen", atomicNumber: 8, row: 2, col: 16, category: "nonmetal" },
  { symbol: "F", name: "Fluorine", atomicNumber: 9, row: 2, col: 17, category: "halogen" },
  { symbol: "Ne", name: "Neon", atomicNumber: 10, row: 2, col: 18, category: "noble-gas" },
  
  // Period 3
  { symbol: "Na", name: "Sodium", atomicNumber: 11, row: 3, col: 1, category: "alkali-metal" },
  { symbol: "Mg", name: "Magnesium", atomicNumber: 12, row: 3, col: 2, category: "alkaline-earth" },
  { symbol: "Al", name: "Aluminum", atomicNumber: 13, row: 3, col: 13, category: "post-transition" },
  { symbol: "Si", name: "Silicon", atomicNumber: 14, row: 3, col: 14, category: "metalloid" },
  { symbol: "P", name: "Phosphorus", atomicNumber: 15, row: 3, col: 15, category: "nonmetal" },
  { symbol: "S", name: "Sulfur", atomicNumber: 16, row: 3, col: 16, category: "nonmetal" },
  { symbol: "Cl", name: "Chlorine", atomicNumber: 17, row: 3, col: 17, category: "halogen" },
  { symbol: "Ar", name: "Argon", atomicNumber: 18, row: 3, col: 18, category: "noble-gas" },
  
  // Period 4
  { symbol: "K", name: "Potassium", atomicNumber: 19, row: 4, col: 1, category: "alkali-metal" },
  { symbol: "Ca", name: "Calcium", atomicNumber: 20, row: 4, col: 2, category: "alkaline-earth" },
  { symbol: "Sc", name: "Scandium", atomicNumber: 21, row: 4, col: 3, category: "transition-metal" },
  { symbol: "Ti", name: "Titanium", atomicNumber: 22, row: 4, col: 4, category: "transition-metal" },
  { symbol: "V", name: "Vanadium", atomicNumber: 23, row: 4, col: 5, category: "transition-metal" },
  { symbol: "Cr", name: "Chromium", atomicNumber: 24, row: 4, col: 6, category: "transition-metal" },
  { symbol: "Mn", name: "Manganese", atomicNumber: 25, row: 4, col: 7, category: "transition-metal" },
  { symbol: "Fe", name: "Iron", atomicNumber: 26, row: 4, col: 8, category: "transition-metal" },
  { symbol: "Co", name: "Cobalt", atomicNumber: 27, row: 4, col: 9, category: "transition-metal" },
  { symbol: "Ni", name: "Nickel", atomicNumber: 28, row: 4, col: 10, category: "transition-metal" },
  { symbol: "Cu", name: "Copper", atomicNumber: 29, row: 4, col: 11, category: "transition-metal" },
  { symbol: "Zn", name: "Zinc", atomicNumber: 30, row: 4, col: 12, category: "transition-metal" },
  { symbol: "Ga", name: "Gallium", atomicNumber: 31, row: 4, col: 13, category: "post-transition" },
  { symbol: "Ge", name: "Germanium", atomicNumber: 32, row: 4, col: 14, category: "metalloid" },
  { symbol: "As", name: "Arsenic", atomicNumber: 33, row: 4, col: 15, category: "metalloid" },
  { symbol: "Se", name: "Selenium", atomicNumber: 34, row: 4, col: 16, category: "nonmetal" },
  { symbol: "Br", name: "Bromine", atomicNumber: 35, row: 4, col: 17, category: "halogen" },
  { symbol: "Kr", name: "Krypton", atomicNumber: 36, row: 4, col: 18, category: "noble-gas" },
  
  // Period 5
  { symbol: "Rb", name: "Rubidium", atomicNumber: 37, row: 5, col: 1, category: "alkali-metal" },
  { symbol: "Sr", name: "Strontium", atomicNumber: 38, row: 5, col: 2, category: "alkaline-earth" },
  { symbol: "Y", name: "Yttrium", atomicNumber: 39, row: 5, col: 3, category: "transition-metal" },
  { symbol: "Zr", name: "Zirconium", atomicNumber: 40, row: 5, col: 4, category: "transition-metal" },
  { symbol: "Nb", name: "Niobium", atomicNumber: 41, row: 5, col: 5, category: "transition-metal" },
  { symbol: "Mo", name: "Molybdenum", atomicNumber: 42, row: 5, col: 6, category: "transition-metal" },
  { symbol: "Tc", name: "Technetium", atomicNumber: 43, row: 5, col: 7, category: "transition-metal" },
  { symbol: "Ru", name: "Ruthenium", atomicNumber: 44, row: 5, col: 8, category: "transition-metal" },
  { symbol: "Rh", name: "Rhodium", atomicNumber: 45, row: 5, col: 9, category: "transition-metal" },
  { symbol: "Pd", name: "Palladium", atomicNumber: 46, row: 5, col: 10, category: "transition-metal" },
  { symbol: "Ag", name: "Silver", atomicNumber: 47, row: 5, col: 11, category: "transition-metal" },
  { symbol: "Cd", name: "Cadmium", atomicNumber: 48, row: 5, col: 12, category: "transition-metal" },
  { symbol: "In", name: "Indium", atomicNumber: 49, row: 5, col: 13, category: "post-transition" },
  { symbol: "Sn", name: "Tin", atomicNumber: 50, row: 5, col: 14, category: "post-transition" },
  { symbol: "Sb", name: "Antimony", atomicNumber: 51, row: 5, col: 15, category: "metalloid" },
  { symbol: "Te", name: "Tellurium", atomicNumber: 52, row: 5, col: 16, category: "metalloid" },
  { symbol: "I", name: "Iodine", atomicNumber: 53, row: 5, col: 17, category: "halogen" },
  { symbol: "Xe", name: "Xenon", atomicNumber: 54, row: 5, col: 18, category: "noble-gas" },
  
  // Period 6
  { symbol: "Cs", name: "Cesium", atomicNumber: 55, row: 6, col: 1, category: "alkali-metal" },
  { symbol: "Ba", name: "Barium", atomicNumber: 56, row: 6, col: 2, category: "alkaline-earth" },
  { symbol: "La", name: "Lanthanum", atomicNumber: 57, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Ce", name: "Cerium", atomicNumber: 58, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Pr", name: "Praseodymium", atomicNumber: 59, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Nd", name: "Neodymium", atomicNumber: 60, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Pm", name: "Promethium", atomicNumber: 61, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Sm", name: "Samarium", atomicNumber: 62, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Eu", name: "Europium", atomicNumber: 63, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Gd", name: "Gadolinium", atomicNumber: 64, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Tb", name: "Terbium", atomicNumber: 65, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Dy", name: "Dysprosium", atomicNumber: 66, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Ho", name: "Holmium", atomicNumber: 67, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Er", name: "Erbium", atomicNumber: 68, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Tm", name: "Thulium", atomicNumber: 69, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Yb", name: "Ytterbium", atomicNumber: 70, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Lu", name: "Lutetium", atomicNumber: 71, row: 6, col: 3, category: "lanthanide" },
  { symbol: "Hf", name: "Hafnium", atomicNumber: 72, row: 6, col: 4, category: "transition-metal" },
  { symbol: "Ta", name: "Tantalum", atomicNumber: 73, row: 6, col: 5, category: "transition-metal" },
  { symbol: "W", name: "Tungsten", atomicNumber: 74, row: 6, col: 6, category: "transition-metal" },
  { symbol: "Re", name: "Rhenium", atomicNumber: 75, row: 6, col: 7, category: "transition-metal" },
  { symbol: "Os", name: "Osmium", atomicNumber: 76, row: 6, col: 8, category: "transition-metal" },
  { symbol: "Ir", name: "Iridium", atomicNumber: 77, row: 6, col: 9, category: "transition-metal" },
  { symbol: "Pt", name: "Platinum", atomicNumber: 78, row: 6, col: 10, category: "transition-metal" },
  { symbol: "Au", name: "Gold", atomicNumber: 79, row: 6, col: 11, category: "transition-metal" },
  { symbol: "Hg", name: "Mercury", atomicNumber: 80, row: 6, col: 12, category: "transition-metal" },
  { symbol: "Tl", name: "Thallium", atomicNumber: 81, row: 6, col: 13, category: "post-transition" },
  { symbol: "Pb", name: "Lead", atomicNumber: 82, row: 6, col: 14, category: "post-transition" },
  { symbol: "Bi", name: "Bismuth", atomicNumber: 83, row: 6, col: 15, category: "post-transition" },
  { symbol: "Po", name: "Polonium", atomicNumber: 84, row: 6, col: 16, category: "metalloid" },
  { symbol: "At", name: "Astatine", atomicNumber: 85, row: 6, col: 17, category: "halogen" },
  { symbol: "Rn", name: "Radon", atomicNumber: 86, row: 6, col: 18, category: "noble-gas" },
  
  // Period 7
  { symbol: "Fr", name: "Francium", atomicNumber: 87, row: 7, col: 1, category: "alkali-metal" },
  { symbol: "Ra", name: "Radium", atomicNumber: 88, row: 7, col: 2, category: "alkaline-earth" },
  { symbol: "Ac", name: "Actinium", atomicNumber: 89, row: 7, col: 3, category: "actinide" },
  { symbol: "Th", name: "Thorium", atomicNumber: 90, row: 7, col: 3, category: "actinide" },
  { symbol: "Pa", name: "Protactinium", atomicNumber: 91, row: 7, col: 3, category: "actinide" },
  { symbol: "U", name: "Uranium", atomicNumber: 92, row: 7, col: 3, category: "actinide" },
  { symbol: "Np", name: "Neptunium", atomicNumber: 93, row: 7, col: 3, category: "actinide" },
  { symbol: "Pu", name: "Plutonium", atomicNumber: 94, row: 7, col: 3, category: "actinide" },
  { symbol: "Am", name: "Americium", atomicNumber: 95, row: 7, col: 3, category: "actinide" },
  { symbol: "Cm", name: "Curium", atomicNumber: 96, row: 7, col: 3, category: "actinide" },
  { symbol: "Bk", name: "Berkelium", atomicNumber: 97, row: 7, col: 3, category: "actinide" },
  { symbol: "Cf", name: "Californium", atomicNumber: 98, row: 7, col: 3, category: "actinide" },
  { symbol: "Es", name: "Einsteinium", atomicNumber: 99, row: 7, col: 3, category: "actinide" },
  { symbol: "Fm", name: "Fermium", atomicNumber: 100, row: 7, col: 3, category: "actinide" },
  { symbol: "Md", name: "Mendelevium", atomicNumber: 101, row: 7, col: 3, category: "actinide" },
  { symbol: "No", name: "Nobelium", atomicNumber: 102, row: 7, col: 3, category: "actinide" },
  { symbol: "Lr", name: "Lawrencium", atomicNumber: 103, row: 7, col: 3, category: "actinide" },
  { symbol: "Rf", name: "Rutherfordium", atomicNumber: 104, row: 7, col: 4, category: "transition-metal" },
  { symbol: "Db", name: "Dubnium", atomicNumber: 105, row: 7, col: 5, category: "transition-metal" },
  { symbol: "Sg", name: "Seaborgium", atomicNumber: 106, row: 7, col: 6, category: "transition-metal" },
  { symbol: "Bh", name: "Bohrium", atomicNumber: 107, row: 7, col: 7, category: "transition-metal" },
  { symbol: "Hs", name: "Hassium", atomicNumber: 108, row: 7, col: 8, category: "transition-metal" },
  { symbol: "Mt", name: "Meitnerium", atomicNumber: 109, row: 7, col: 9, category: "transition-metal" },
  { symbol: "Ds", name: "Darmstadtium", atomicNumber: 110, row: 7, col: 10, category: "transition-metal" },
  { symbol: "Rg", name: "Roentgenium", atomicNumber: 111, row: 7, col: 11, category: "transition-metal" },
  { symbol: "Cn", name: "Copernicium", atomicNumber: 112, row: 7, col: 12, category: "transition-metal" },
  { symbol: "Nh", name: "Nihonium", atomicNumber: 113, row: 7, col: 13, category: "post-transition" },
  { symbol: "Fl", name: "Flerovium", atomicNumber: 114, row: 7, col: 14, category: "post-transition" },
  { symbol: "Mc", name: "Moscovium", atomicNumber: 115, row: 7, col: 15, category: "post-transition" },
  { symbol: "Lv", name: "Livermorium", atomicNumber: 116, row: 7, col: 16, category: "post-transition" },
  { symbol: "Ts", name: "Tennessine", atomicNumber: 117, row: 7, col: 17, category: "halogen" },
  { symbol: "Og", name: "Oganesson", atomicNumber: 118, row: 7, col: 18, category: "noble-gas" },
];

export const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    "alkali-metal": "bg-red-100 hover:bg-red-200 border-red-300",
    "alkaline-earth": "bg-orange-100 hover:bg-orange-200 border-orange-300",
    "transition-metal": "bg-yellow-100 hover:bg-yellow-200 border-yellow-300",
    "post-transition": "bg-green-100 hover:bg-green-200 border-green-300",
    "metalloid": "bg-teal-100 hover:bg-teal-200 border-teal-300",
    "nonmetal": "bg-blue-100 hover:bg-blue-200 border-blue-300",
    "halogen": "bg-purple-100 hover:bg-purple-200 border-purple-300",
    "noble-gas": "bg-pink-100 hover:bg-pink-200 border-pink-300",
    "lanthanide": "bg-cyan-100 hover:bg-cyan-200 border-cyan-300",
    "actinide": "bg-indigo-100 hover:bg-indigo-200 border-indigo-300",
  };
  return colors[category] || "bg-gray-100 hover:bg-gray-200 border-gray-300";
};

/** Parse help_text (one element per line) into a Set of symbols to disable in the periodic selector. */
export function parseDisabledElementsFromHelpText(helpText: string | null | undefined): Set<string> {
  return parsePeriodicHelpText(helpText).disabled;
}

/** Parse help_text lines starting with `/` (e.g. `/C`) into locked preselected symbols. */
export function parsePreselectedElementsFromHelpText(helpText: string | null | undefined): Set<string> {
  return parsePeriodicHelpText(helpText).preselected;
}

export type PeriodicHelpTextParsed = {
  /** Excluded from selection (plain lines in Help text). */
  disabled: Set<string>;
  /** Forced selected, not billable, not user-deselectable (`/C` lines in Help text). */
  preselected: Set<string>;
};

/**
 * Help text for PERIODIC_TABLE fields:
 * - Plain line (`C` or `Carbon`) → disabled / excluded from selection
 * - Slash-prefixed line (`/C` or `/Carbon`) → locked preselected (shown selected, not billable)
 * If the same element appears in both forms, preselected wins.
 */
export function parsePeriodicHelpText(helpText: string | null | undefined): PeriodicHelpTextParsed {
  const disabled = new Set<string>();
  const preselected = new Set<string>();
  if (!helpText || typeof helpText !== "string") return { disabled, preselected };

  const bySymbol = new Map<string, string>();
  const byName = new Map<string, string>();
  periodicTableElements.forEach((el) => {
    bySymbol.set(el.symbol.toLowerCase(), el.symbol);
    byName.set(el.name.toLowerCase(), el.symbol);
  });

  const resolve = (raw: string): string | undefined => {
    const cleaned = raw.replace(/[,;]+/g, " ").trim();
    if (!cleaned) return undefined;
    const firstToken = cleaned.split(/\s+/)[0]?.trim() || "";
    return (
      bySymbol.get(firstToken.toLowerCase()) ??
      byName.get(cleaned.toLowerCase()) ??
      byName.get(firstToken.toLowerCase())
    );
  };

  helpText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (line.startsWith("/")) {
        const sym = resolve(line.slice(1).trim());
        if (sym) preselected.add(sym);
        return;
      }
      const sym = resolve(line);
      if (sym) disabled.add(sym);
    });

  // Preselected overrides disabled when both are configured.
  preselected.forEach((sym) => disabled.delete(sym));
  return { disabled, preselected };
}

/** Billable symbols: selected minus disabled minus locked-preselected. */
export function billablePeriodicSymbols(
  selectedSymbols: Iterable<string>,
  helpText: string | null | undefined
): string[] {
  const { disabled, preselected } = parsePeriodicHelpText(helpText);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of selectedSymbols) {
    const sym = String(raw || "").trim();
    if (!sym || seen.has(sym) || disabled.has(sym) || preselected.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
  }
  return out;
}

/** Full display selection: locked preselected first, then billable user picks. */
export function mergePeriodicDisplaySymbols(
  selectedSymbols: Iterable<string>,
  helpText: string | null | undefined
): { all: string[]; billable: string[]; preselected: string[] } {
  const { preselected } = parsePeriodicHelpText(helpText);
  const preselectedList = Array.from(preselected);
  const billable = billablePeriodicSymbols(selectedSymbols, helpText);
  const all = [...preselectedList, ...billable.filter((s) => !preselected.has(s))];
  return { all, billable, preselected: preselectedList };
}
