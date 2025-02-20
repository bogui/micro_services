export default (text: string, targetLanguage: string): string => {
  let translation;
  try {
    translation = require(`../locales/${targetLanguage}.json`);
    const result = text
      .split('.')
      .reduce((obj, key) => obj?.[key], translation);
    if (result === undefined) {
      translation = require('../locales/bg.json');
    }
  } catch {
    translation = require('../locales/bg.json');
  }

  return text.split('.').reduce((obj, key) => obj?.[key], translation);
};
