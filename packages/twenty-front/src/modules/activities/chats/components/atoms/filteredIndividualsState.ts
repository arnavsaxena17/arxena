import { atom } from 'recoil';
import * as frontChatTypes from "../../types/front-chat-types";

export const filteredIndividualsState = atom<frontChatTypes.PersonNode[]>({
  key: 'filteredIndividualsState',
  default: [],
});
