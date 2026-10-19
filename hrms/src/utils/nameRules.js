// Person names: letters in any script (Arabic, accented Latin…), words joined
// by one space, hyphen, apostrophe or dot — "Abdul-Rahman Al-Harbi",
// "O'Brien", "محمد العتيبي", "John Smith Jr.". Shared by Add and Edit
// Employee so both accept exactly the same names.
export const NAME_PATTERN = /^[\p{L}\p{M}]+(?:(?:[ '’.-]|\. )[\p{L}\p{M}]+)*\.?$/u;

// What typing may keep: letters, spaces and ' ’ - . (drops digits, emoji…).
export const NAME_STRIP = /[^\p{L}\p{M}\s'’.-]/gu;
