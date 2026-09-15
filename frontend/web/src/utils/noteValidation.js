/**
 * utils/noteValidation.js
 *
 * Shared validation for Internal Notes fields across all role-based
 * ticket modals (CSR, Employee, Admin, Super Admin).
 *
 * Philosophy: this is a SOFT check, not a hard blocker. It flags likely
 * gibberish/junk input so the UI can show a warning, but never prevents
 * submission outright. False positives (real short notes, pasted error
 * codes/hashes, etc.) should never be rejected.
 */

const MAX_LENGTH = 1000;
const WARNING_THRESHOLD = MAX_LENGTH - 100; // start amber warning here

/**
 * Checks for 4+ identical characters repeated consecutively.
 * Catches: "AAAAAAAA", "hahahaaaaaa" (partial), "!!!!!!"
 */
function hasExcessiveCharRepetition(text) {
  return /(.)\1{3,}/.test(text);
}

/**
 * Checks for a short substring (2-4 chars) repeated 4+ times in a row.
 * Catches: "hahahahaha", "asdasdasdasd", "lolol lolol"
 */
function hasRepeatedPattern(text) {
  // Look for any 2-4 char sequence that repeats 4+ times back to back
  return /(.{2,4})\1{3,}/.test(text.replace(/\s/g, ''));
}

/**
 * Long word-like tokens with zero spaces are a common sign of
 * keyboard mashing rather than real sentences.
 * Catches: "dsajdbasjbdsjandjsandjsandsa"
 * Does NOT flag legitimate long single tokens like URLs, hashes,
 * or camelCase identifiers below a generous threshold.
 */
function hasNoSpacesLongRun(text, threshold = 25) {
  const trimmed = text.trim();
  if (trimmed.length < threshold) return false;
  if (trimmed.includes(' ')) return false;
  // Allow common legitimate no-space content: URLs, emails, hex/hash strings
  const looksLikeUrlOrId =
    /^(https?:\/\/|www\.)/i.test(trimmed) ||
    /^[a-f0-9]{16,}$/i.test(trimmed) || // long hex hash
    /^[\w.-]+@[\w.-]+\.\w+$/.test(trimmed); // email
  return !looksLikeUrlOrId;
}

/**
 * Abnormal case-switching (aHAAAAAAHDADHADHAH) is a strong signal of
 * mashing rather than typing, since real text rarely alternates case
 * on more than ~1 in 10 characters.
 */
function hasAbnormalCaseSwitching(text, ratioThreshold = 0.4) {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 8) return false; // too short to judge reliably

  let switches = 0;
  for (let i = 1; i < letters.length; i++) {
    const prevIsUpper = letters[i - 1] === letters[i - 1].toUpperCase();
    const currIsUpper = letters[i] === letters[i].toUpperCase();
    if (prevIsUpper !== currIsUpper) switches++;
  }
  const ratio = switches / (letters.length - 1);
  return ratio > ratioThreshold;
}

/**
 * Very low vowel ratio in long alphabetic runs is another mashing signal.
 * Real English text is typically ~35-45% vowels; keyboard mashing on
 * QWERTY often skews heavily consonant-only ("dsjbfkqwxzpq").
 * Kept conservative (only flags long stretches) to avoid false positives
 * on abbreviations, codes, or non-English names.
 */
function hasAbnormalVowelRatio(text, minLength = 20, minRatio = 0.15) {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < minLength) return false;
  const vowels = (letters.match(/[aeiouAEIOU]/g) || []).length;
  return vowels / letters.length < minRatio;
}

/**
 * Main validation entry point.
 * @param {string} text - the note content to validate
 * @returns {{ isValid: boolean, warning: string|null, isOverLimit: boolean, charsRemaining: number, showCounter: boolean, debugFlags: string[] }}
 */
export function validateNoteText(text) {
  const trimmed = (text || '').trim();
  const length = (text || '').length;

  const isOverLimit = length > MAX_LENGTH;
  const charsRemaining = MAX_LENGTH - length;

  // Empty notes are handled separately by required-field validation,
  // not this utility — treat as valid/no-warning here.
  if (trimmed.length === 0) {
    return {
      isValid: true,
      warning: null,
      isOverLimit: false,
      charsRemaining: MAX_LENGTH,
      showCounter: false,
      debugFlags: [],
    };
  }

  const flags = [];
  if (hasExcessiveCharRepetition(trimmed)) flags.push('repeated characters');
  if (hasRepeatedPattern(trimmed)) flags.push('repeated pattern');
  if (hasNoSpacesLongRun(trimmed)) flags.push('no spaces in long text');
  if (hasAbnormalCaseSwitching(trimmed)) flags.push('unusual capitalization');
  if (hasAbnormalVowelRatio(trimmed)) flags.push('unusual character pattern');

  const looksLikeGibberish = flags.length > 0;

  return {
    isValid: !isOverLimit, // only length is a hard constraint
    warning: looksLikeGibberish
      ? 'This note looks unclear — please check before submitting.'
      : null,
    isOverLimit,
    charsRemaining,
    showCounter: length >= WARNING_THRESHOLD || isOverLimit,
    debugFlags: flags, // useful in dev/testing; strip or ignore in prod UI
  };
}

export const NOTE_MAX_LENGTH = MAX_LENGTH;
export const NOTE_WARNING_THRESHOLD = WARNING_THRESHOLD;
