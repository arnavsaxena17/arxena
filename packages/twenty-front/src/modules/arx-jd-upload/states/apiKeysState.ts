import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export type ApiKey = {
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
  is_org_chart_enabled?: string;
};

export const apiKeysState = createAtomState<ApiKey>({
  key: 'apiKeysState',
  defaultValue: {},
});

export const originalApiKeysState = createAtomState<ApiKey>({
  key: 'originalApiKeysState',
  defaultValue: {},
});

export const apiKeysLoadingState = createAtomState<boolean>({
  key: 'apiKeysLoadingState',
  defaultValue: false,
});

export const apiKeysErrorState = createAtomState<string | null>({
  key: 'apiKeysErrorState',
  defaultValue: null,
});
