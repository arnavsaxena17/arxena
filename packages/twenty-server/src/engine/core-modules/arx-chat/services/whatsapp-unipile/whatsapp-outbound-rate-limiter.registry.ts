import { WhatsappOutboundRateLimiterService } from './whatsapp-outbound-rate-limiter.service';

let registeredWhatsappOutboundRateLimiter:
  | WhatsappOutboundRateLimiterService
  | undefined;

export const registerWhatsappOutboundRateLimiter = (
  service: WhatsappOutboundRateLimiterService,
): void => {
  registeredWhatsappOutboundRateLimiter = service;
};

export const getRegisteredWhatsappOutboundRateLimiter = ():
  | WhatsappOutboundRateLimiterService
  | undefined => registeredWhatsappOutboundRateLimiter;
