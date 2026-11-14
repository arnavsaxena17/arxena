export type LocalBusinessEmailsAndContacts = {
  emails?: string[] | null;
  phone_numbers?: string[] | null;
  facebook?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  [key: string]: unknown;
};

export type LocalBusinessPhotoSample = {
  photo_id?: string | null;
  photo_url?: string | null;
  photo_url_large?: string | null;
  type?: string | null;
};

export type LocalBusinessRecord = {
  business_id?: string | null;
  google_id?: string | null;
  place_id?: string | null;
  name?: string | null;
  phone_number?: string | null;
  website?: string | null;
  full_address?: string | null;
  address?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  country?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  review_count?: number | null;
  type?: string | null;
  subtypes?: string[] | null;
  business_status?: string | null;
  verified?: boolean | null;
  place_link?: string | null;
  timezone?: string | null;
  about?: {
    summary?: string | null;
    details?: unknown;
  } | null;
  photos_sample?: LocalBusinessPhotoSample[] | null;
  emails_and_contacts?: LocalBusinessEmailsAndContacts | null;
  [key: string]: unknown;
};

export type LocalBusinessApiOkResponse<TData> = {
  status: 'OK';
  request_id?: string;
  parameters?: Record<string, unknown>;
  data: TData;
};

export type LocalBusinessApiErrorResponse = {
  status: 'ERROR';
  request_id?: string;
  error?: {
    message?: string;
    code?: number;
  };
};

export type LocalBusinessApiResponse<TData> =
  | LocalBusinessApiOkResponse<TData>
  | LocalBusinessApiErrorResponse;

export type LocalBusinessSearchParams = {
  query: string;
  limit?: number;
  lat?: number;
  lng?: number;
  zoom?: number;
  language?: string;
  region?: string;
  extractEmailsAndContacts?: boolean;
  subtypes?: string;
  verified?: boolean;
  businessStatus?: string;
  fields?: string;
};

export type LocalBusinessSearchNearbyParams = {
  query: string;
  lat: number;
  lng: number;
  limit?: number;
  language?: string;
  region?: string;
  extractEmailsAndContacts?: boolean;
  subtypes?: string;
  verified?: boolean;
  businessStatus?: string;
  fields?: string;
};

export type LocalBusinessSearchInAreaParams = {
  query: string;
  lat: number;
  lng: number;
  zoom?: number;
  limit?: number;
  language?: string;
  region?: string;
  extractEmailsAndContacts?: boolean;
  subtypes?: string;
  verified?: boolean;
  businessStatus?: string;
  fields?: string;
};

export type LocalBusinessDetailsParams = {
  businessIds: string[];
  extractEmailsAndContacts?: boolean;
  extractShareLink?: boolean;
  language?: string;
  region?: string;
  fields?: string;
};

export type LocalBusinessAutocompleteParams = {
  query: string;
  language?: string;
  region?: string;
};
