# WhatsApp Unipile @lid Migration Guide

## Overview
WhatsApp has migrated from phone number-based identifiers to @lid (LinkedIn ID) format identifiers. This document outlines the changes made to support this migration.

## Key Changes

### 1. Type Definitions Updated
- **File**: `packages/twenty-server/src/engine/core-modules/arx-chat/types/unipile-webhook.types.ts`
- **Changes**:
  - Added `attendee_specifics` field to `UnipileWebhookAttendee` interface
  - Added `attendee_public_identifier` field to `UnipileWebhookAttendee` interface
  - Updated `UnipileMessageWebhook` to include additional fields like `is_sender`, `attachments`, etc.
  - Made `message` field nullable to handle attachment-only messages

### 2. Phone Number Extraction
- **File**: `packages/twenty-server/src/engine/core-modules/arx-chat/services/whatsapp-api/incoming-messages.ts`
- **New Helper Functions**:
  - `extractPhoneNumberFromAttendee()`: Extracts phone numbers from the correct fields:
    1. `attendee_specifics.phone_number` (most reliable)
    2. `attendee_public_identifier` (format: "918411937769@s.whatsapp.net")
    3. Fallback to old format in `attendee_provider_id` for backward compatibility
  - `isMessageFromConnectedUser()`: Checks if message is from connected user:
    1. Uses `is_sender` field if available
    2. Compares `account_info.user_id` with `sender.attendee_provider_id` (both @lid)
    3. Fallback to phone number comparison

### 3. Updated Message Processing
- **Function**: `receiveIncomingMessageFromWhatsappUnipile()`
  - Now uses helper functions to extract phone numbers correctly
  - Handles null messages (for attachments)
  - Properly identifies self messages using new logic

- **Function**: `getApiKeyToUseFromWhatsappUnipileMessageReceived()`
  - Updated to use `extractPhoneNumberFromAttendee()` instead of parsing `attendee_provider_id`
  - Correctly extracts phone numbers from new fields

## Important Notes

### Phone Number Storage
- **No changes needed**: We still store phone numbers in `whatsapp_web_phone_number` and use them for matching
- **Account ID**: We use `whatsapp_unipile_account_id` to find workspace, which doesn't change

### Sending Messages
- **No changes needed**: According to Unipile, chats must still be initiated using phone numbers
- The sending logic in `whatsapp-unipile-messaging.service.ts` already uses phone numbers correctly

### @lid Identifiers
- **Not stored**: We don't need to store @lid identifiers separately
- **Used for matching**: @lid identifiers are used internally by Unipile for chat/attendee matching
- **Phone numbers still required**: Phone numbers are still needed for:
  - Initiating chats
  - Finding candidates in database
  - Matching messages to workspace

## Migration Steps

### 1. Code Changes (✅ Completed)
- [x] Update type definitions
- [x] Add helper functions for phone number extraction
- [x] Update incoming message handlers
- [x] Fix null message handling

### 2. Testing Required
- [ ] Test incoming messages from external contacts
- [ ] Test incoming self messages (messages sent by connected user)
- [ ] Test messages with attachments (null message content)
- [ ] Test duplicate message detection
- [ ] Test message delivery status updates

### 3. Account Reconnection (Required by Unipile)
- [ ] Users need to reconnect WhatsApp accounts after Unipile's migration (Dec 21, 2025)
- [ ] This will rebuild the @lid to phone number mapping in Unipile's system
- [ ] No code changes needed for this - handled by Unipile

## Backward Compatibility

The code maintains backward compatibility:
- Still handles old format phone numbers in `attendee_provider_id` if present
- Falls back to phone number comparison if @lid comparison fails
- Works with both old and new webhook payload formats

## Potential Issues

### 1. Messages with Null Content
- Currently handled by using empty string
- May need separate handling for attachment-only messages in the future

### 2. Self Messages
- Recipient should always be in `attendees` array
- Fallback to workspace phone number if not found

### 3. Phone Number Extraction Failures
- If phone number cannot be extracted, message processing is skipped
- This is expected behavior for invalid webhook payloads

## Questions Answered

### Q: Do we need to save @lid identifiers?
**A**: No. We use `whatsapp_unipile_account_id` to find the workspace, and phone numbers for candidate matching. @lid identifiers are internal to Unipile.

### Q: What changes when connecting WhatsApp accounts?
**A**: No code changes needed. Users just need to reconnect their accounts after Unipile's migration to rebuild the mapping.

### Q: How do we extract phone numbers now?
**A**: Use the new `extractPhoneNumberFromAttendee()` helper function which checks:
1. `attendee_specifics.phone_number`
2. `attendee_public_identifier`
3. Old format in `attendee_provider_id` (backward compatibility)

### Q: What about sending messages?
**A**: No changes needed. We still use phone numbers to initiate chats, as required by Unipile.

