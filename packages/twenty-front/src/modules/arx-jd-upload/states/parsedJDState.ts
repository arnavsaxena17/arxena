import { atom } from 'recoil';
import { ParsedJD } from '../types/ParsedJD';
import { blankParsedJD } from '../utils/createDefaultParsedJD';

export const parsedJDState = atom<ParsedJD>({
  key: 'parsedJDState',
  default: blankParsedJD,
}); 