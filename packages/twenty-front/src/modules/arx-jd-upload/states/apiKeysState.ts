import { atom } from 'recoil';

export interface ApiKey {
  openaikey?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  linkedin_url?: string;
  whatsapp_key?: string;
  anthropic_key?: string;
  facebook_whatsapp_api_token?: string;
  facebook_whatsapp_phone_number_id?: string;
  facebook_whatsapp_app_id?: string;
  linkedin_unipile_account_id?: string;
  whatsapp_unipile_account_id?: string;
  linkedin_profile_id?: string;
  whatsapp_web_phone_number?: string;
  facebook_whatsapp_asset_id?: string;
  is_chrome_extension_installed?: string;
  chrome_extension_id?: string;
}

export const apiKeysState = atom<ApiKey>({
  key: 'apiKeysState',
  default: {},
});

export const originalApiKeysState = atom<ApiKey>({
  key: 'originalApiKeysState',
  default: {},
});

export const apiKeysLoadingState = atom<boolean>({
  key: 'apiKeysLoadingState',
  default: false,
});

export const apiKeysErrorState = atom<string | null>({
  key: 'apiKeysErrorState',
  default: null,
});
