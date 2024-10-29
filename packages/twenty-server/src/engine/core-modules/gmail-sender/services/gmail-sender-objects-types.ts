// export interface GmailMessageData {
//   sendEmailTo: string;
//   sendEmailFrom: string;
//   subject: string;
//   message: string;
// }


export interface GmailMessageData {
  sendEmailFrom: string;
  sendEmailTo: string;
  subject: string;
  message: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
}

