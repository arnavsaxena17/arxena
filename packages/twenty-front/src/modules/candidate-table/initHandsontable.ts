import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { registerAllModules } from 'handsontable/registry';

let isHandsontableInitialized = false;

export const initHandsontable = () => {
  if (isHandsontableInitialized) {
    return;
  }

  registerAllModules();
  isHandsontableInitialized = true;
};

initHandsontable();
