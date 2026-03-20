// Ge'ez Fidel Alphabet Data Model
// The Ge'ez writing system is a 2D grid: consonant families (rows) × 7 vowel orders (columns)
// Each cell is a unique syllable character

export interface FidelChar {
  char: string;
  consonant: string;       // Consonant family name (e.g., "ha", "le", "me")
  consonantIndex: number;  // Row index in the fidel grid
  vowelOrder: number;      // 1-7 vowel order (column)
  romanized: string;       // Romanized pronunciation
}

// The 7 vowel orders (columns)
export const VOWEL_ORDERS = [
  { order: 1, label: 'ä (1st)', vowel: 'ä' },
  { order: 2, label: 'u (2nd)', vowel: 'u' },
  { order: 3, label: 'i (3rd)', vowel: 'i' },
  { order: 4, label: 'a (4th)', vowel: 'a' },
  { order: 5, label: 'é (5th)', vowel: 'é' },
  { order: 6, label: 'e/ə (6th)', vowel: 'e' },
  { order: 7, label: 'o (7th)', vowel: 'o' },
];

// Consonant families with their 7 vowel order characters
// Format: [1st, 2nd, 3rd, 4th, 5th, 6th, 7th]
export const FIDEL_FAMILIES: { name: string; chars: string[]; romanBase: string }[] = [
  { name: 'hä', chars: ['ሀ', 'ሁ', 'ሂ', 'ሃ', 'ሄ', 'ህ', 'ሆ'], romanBase: 'h' },
  { name: 'lä', chars: ['ለ', 'ሉ', 'ሊ', 'ላ', 'ሌ', 'ል', 'ሎ'], romanBase: 'l' },
  { name: 'ḥä', chars: ['ሐ', 'ሑ', 'ሒ', 'ሓ', 'ሔ', 'ሕ', 'ሖ'], romanBase: 'ḥ' },
  { name: 'mä', chars: ['መ', 'ሙ', 'ሚ', 'ማ', 'ሜ', 'ም', 'ሞ'], romanBase: 'm' },
  { name: 'śä', chars: ['ሠ', 'ሡ', 'ሢ', 'ሣ', 'ሤ', 'ሥ', 'ሦ'], romanBase: 'ś' },
  { name: 'rä', chars: ['ረ', 'ሩ', 'ሪ', 'ራ', 'ሬ', 'ር', 'ሮ'], romanBase: 'r' },
  { name: 'sä', chars: ['ሰ', 'ሱ', 'ሲ', 'ሳ', 'ሴ', 'ስ', 'ሶ'], romanBase: 's' },
  { name: 'šä', chars: ['ሸ', 'ሹ', 'ሺ', 'ሻ', 'ሼ', 'ሽ', 'ሾ'], romanBase: 'š' },
  { name: 'qä', chars: ['ቀ', 'ቁ', 'ቂ', 'ቃ', 'ቄ', 'ቅ', 'ቆ'], romanBase: 'q' },
  { name: 'bä', chars: ['በ', 'ቡ', 'ቢ', 'ባ', 'ቤ', 'ብ', 'ቦ'], romanBase: 'b' },
  { name: 'tä', chars: ['ተ', 'ቱ', 'ቲ', 'ታ', 'ቴ', 'ት', 'ቶ'], romanBase: 't' },
  { name: 'čä', chars: ['ቸ', 'ቹ', 'ቺ', 'ቻ', 'ቼ', 'ች', 'ቾ'], romanBase: 'č' },
  { name: 'ḫä', chars: ['ኀ', 'ኁ', 'ኂ', 'ኃ', 'ኄ', 'ኅ', 'ኆ'], romanBase: 'ḫ' },
  { name: 'nä', chars: ['ነ', 'ኑ', 'ኒ', 'ና', 'ኔ', 'ን', 'ኖ'], romanBase: 'n' },
  { name: 'ñä', chars: ['ኘ', 'ኙ', 'ኚ', 'ኛ', 'ኜ', 'ኝ', 'ኞ'], romanBase: 'ñ' },
  { name: 'ʾä', chars: ['አ', 'ኡ', 'ኢ', 'ኣ', 'ኤ', 'እ', 'ኦ'], romanBase: 'ʾ' },
  { name: 'kä', chars: ['ከ', 'ኩ', 'ኪ', 'ካ', 'ኬ', 'ክ', 'ኮ'], romanBase: 'k' },
  { name: 'wä', chars: ['ወ', 'ዉ', 'ዊ', 'ዋ', 'ዌ', 'ው', 'ዎ'], romanBase: 'w' },
  { name: 'ʿä', chars: ['ዐ', 'ዑ', 'ዒ', 'ዓ', 'ዔ', 'ዕ', 'ዖ'], romanBase: 'ʿ' },
  { name: 'zä', chars: ['ዘ', 'ዙ', 'ዚ', 'ዛ', 'ዜ', 'ዝ', 'ዞ'], romanBase: 'z' },
  { name: 'žä', chars: ['ዠ', 'ዡ', 'ዢ', 'ዣ', 'ዤ', 'ዥ', 'ዦ'], romanBase: 'ž' },
  { name: 'yä', chars: ['የ', 'ዩ', 'ዪ', 'ያ', 'ዬ', 'ይ', 'ዮ'], romanBase: 'y' },
  { name: 'dä', chars: ['ደ', 'ዱ', 'ዲ', 'ዳ', 'ዴ', 'ድ', 'ዶ'], romanBase: 'd' },
  { name: 'ǧä', chars: ['ጀ', 'ጁ', 'ጂ', 'ጃ', 'ጄ', 'ጅ', 'ጆ'], romanBase: 'ǧ' },
  { name: 'gä', chars: ['ገ', 'ጉ', 'ጊ', 'ጋ', 'ጌ', 'ግ', 'ጎ'], romanBase: 'g' },
  { name: 'ṭä', chars: ['ጠ', 'ጡ', 'ጢ', 'ጣ', 'ጤ', 'ጥ', 'ጦ'], romanBase: 'ṭ' },
  { name: 'č̣ä', chars: ['ጨ', 'ጩ', 'ጪ', 'ጫ', 'ጬ', 'ጭ', 'ጮ'], romanBase: 'č̣' },
  { name: 'p̣ä', chars: ['ጰ', 'ጱ', 'ጲ', 'ጳ', 'ጴ', 'ጵ', 'ጶ'], romanBase: 'p̣' },
  { name: 'ṣä', chars: ['ጸ', 'ጹ', 'ጺ', 'ጻ', 'ጼ', 'ጽ', 'ጾ'], romanBase: 'ṣ' },
  { name: 'ṣ́ä', chars: ['ፀ', 'ፁ', 'ፂ', 'ፃ', 'ፄ', 'ፅ', 'ፆ'], romanBase: 'ṣ́' },
  { name: 'fä', chars: ['ፈ', 'ፉ', 'ፊ', 'ፋ', 'ፌ', 'ፍ', 'ፎ'], romanBase: 'f' },
  { name: 'pä', chars: ['ፐ', 'ፑ', 'ፒ', 'ፓ', 'ፔ', 'ፕ', 'ፖ'], romanBase: 'p' },
];

// Build a flat lookup of all fidel characters
export function buildFidelLookup(): FidelChar[] {
  const vowelSuffixes = ['ä', 'u', 'i', 'a', 'é', 'e', 'o'];
  const result: FidelChar[] = [];

  FIDEL_FAMILIES.forEach((family, consonantIndex) => {
    family.chars.forEach((char, vowelIdx) => {
      result.push({
        char,
        consonant: family.name,
        consonantIndex,
        vowelOrder: vowelIdx + 1,
        romanized: family.romanBase + vowelSuffixes[vowelIdx],
      });
    });
  });

  return result;
}

// Get all characters for a specific vowel order (column)
export function getCharsByVowelOrder(order: number): FidelChar[] {
  return buildFidelLookup().filter(c => c.vowelOrder === order);
}

// Get all characters for a specific consonant family (row)
export function getCharsByConsonant(consonantIndex: number): FidelChar[] {
  return buildFidelLookup().filter(c => c.consonantIndex === consonantIndex);
}

// Get a random subset of consonant families for a game level
export function getRandomFamilies(count: number): typeof FIDEL_FAMILIES {
  const shuffled = [...FIDEL_FAMILIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
