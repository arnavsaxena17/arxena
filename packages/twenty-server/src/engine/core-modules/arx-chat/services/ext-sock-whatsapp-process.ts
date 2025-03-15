import { WhatsappMessageData } from 'twenty-shared';

export async function processMessage(
  messageData: WhatsappMessageData,
): Promise<void> {
  try {
    console.log(`Processing WhatsApp message: ${messageData.id}`);
    console.log(`Received WhatsApp message: ${messageData}`);

    // Implement your message processing logic here
    // For example:
    // 1. Parse the message content
    // 2. Store in database
    // 3. Send notifications
    // 4. Trigger any business logic

    console.log(`Successfully processed WhatsApp message: ${messageData.id}`);
  } catch (error) {
    console.error(
      `Failed to process WhatsApp message ${messageData.id}:`,
      error,
    );
    throw error;
  }
}
