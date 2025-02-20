export default (text: string, targetLanguage: string): string => {
  let translation;
  try {
    // First try to load the requested language
    translation = require(`../locales/${targetLanguage}.json`);
    const result = text
      .split('.')
      .reduce((obj, key) => obj?.[key], translation);

    // If translation not found, fallback to Bulgarian
    if (result === undefined) {
      translation = require('../locales/bg.json');
      const fallbackResult = text
        .split('.')
        .reduce((obj, key) => obj?.[key], translation);
      return fallbackResult || text;
    }
    return result;
  } catch {
    // If language file not found or other error, fallback to Bulgarian
    try {
      translation = require('../locales/bg.json');
      const fallbackResult = text
        .split('.')
        .reduce((obj, key) => obj?.[key], translation);
      return fallbackResult || text;
    } catch {
      return text;
    }
  }
};
