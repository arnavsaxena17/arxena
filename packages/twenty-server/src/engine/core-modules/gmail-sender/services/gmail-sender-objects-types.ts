// export interface GmailMessageData {
//   sendEmailTo: string;
//   sendEmailFrom: string;
//   subject: string;
//   message: string;
// }


export interface GmailMessageData {
  sendEmailFrom: string;
  sendEmailNameFrom: string;
  sendEmailTo: string;
  sendEmailNameTo?: string;
  subject: string;
  message: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

