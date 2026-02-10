import { randomNumber } from '../crypto/index.js';
import { EEFLongWordList } from './words.js';

/* generate a passphrase that includes random numbers */
export function generatePassphrase(numWords: number): string[] {
  const words = new Array(numWords);

  for (let i = 0; i < numWords; i++) {
    const wordIndex = randomNumber(0, EEFLongWordList.length - 1);
    let word = EEFLongWordList[wordIndex];
    word += randomNumber(0, 9).toString();
    words[i] = word;
  }

  return words;
}
