import { Injectable } from "@nestjs/common";
import moment from "moment";

import { promises as fs } from "fs";
import path from "path";
import process from "process";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";
import { env } from "process";
import * as gmailSenderTypes from "./services/gmail-sender-objects-types";
import axios from "axios";
import * as mime from "mime-types";

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.drafts',
  'https://mail.google.com',
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = process.cwd() + "/token.json";
console.log("This is the process cwd:", process.cwd());
const CREDENTIALS_PATH = process.cwd() + "/credentials.json";
console.log("This is the token path:", TOKEN_PATH);
console.log("This is the CREDENTIALS_PATH path:", CREDENTIALS_PATH);
@Injectable()
export class MailerService {
  private transporter;
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_CLIENT_ID,
      process.env.AUTH_GOOGLE_CLIENT_SECRET,
      process.env.AUTH_GOOGLE_CALLBACK_URL
    );
    this.oauth2Client.setCredentials({
      access_token: "YOUR_ACCESS_TOKEN",
      refresh_token: "YOUR_REFRESH_TOKEN",
      scope:SCOPES,
      token_type: "Bearer",

      //@ts-ignore
      expiry_date: moment().add(1, "hour").unix(),
    });
  }

  /**
   * Reads previously authorized credentials from the save file.
   *
   * @return {Promise<OAuth2Client|null>}
   */
  async loadSavedCredentialsIfExist() {
    const connectedAccountsResponse = await axios.request({
      method: "get",
      url: "http://localhost:3000/rest/connectedAccounts",
      headers: {
        authorization: "Bearer " + process.env.TWENTY_JWT_SECRET,
        "content-type": "application/json",
      },
    });
    if (connectedAccountsResponse?.data?.data?.connectedAccounts?.length > 0) {
      const connectedAccountToUse = connectedAccountsResponse?.data?.data?.connectedAccounts.filter(x => x.handle === process.env.EMAIL_SMTP_USER)[0];
      const refreshToken = connectedAccountToUse ?.refreshToken;
      if (!refreshToken) {
        return null;
      }

      try {
        const credentials = {
          type: "authorized_user",
          client_id: process.env.AUTH_GOOGLE_CLIENT_ID,
          client_secret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
        };

        return google.auth.fromJSON(credentials);
      } catch (err) {
        return null;
      }
    }
  }

  /**
   * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
   *
   * @param {OAuth2Client} client
   * @return {Promise<void>}
   */
  async saveCredentials(client) {
    const payload = JSON.stringify({
      type: "authorized_user",
      client_id: process.env.AUTH_GOOGLE_CLIENT_ID,
      client_secret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
      refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
  }
  async authorize() {
    let client = await this.loadSavedCredentialsIfExist();
    if (client) {
      return client;
    }

    // @ts-ignore
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    // @ts-ignore
    if (client.credentials) {
      await this.saveCredentials(client);
    }
    return client;
  }

  /**
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  async sendMails(auth, gmailMessageData: gmailSenderTypes.GmailMessageData) {
    const gmail = google.gmail({ version: "v1", auth });
    console.log("This is the gmail message data:", gmailMessageData);
    console.log("This is the process.env.EMAIL_SMTP_USER_NAME:", process.env.EMAIL_SMTP_USER_NAME);
    console.log("This is the process.env.EMAIL_SMTP_USER:", process.env.EMAIL_SMTP_USER);
    const emailLines = [
      `From: "${process.env.EMAIL_SMTP_USER_NAME}" <${process.env.EMAIL_SMTP_USER}>`,
      `To: ${gmailMessageData.sendEmailTo}`,
      "Content-type: text/html;charset=iso-8859-1",
      "X-Mailer: Arxena-App",
      "MIME-Version: 1.0",
      `Subject: ${gmailMessageData.subject}`,
      "",
      gmailMessageData.message,
    ];

    const email = emailLines.join("\r\n").trim();
    const base64Email = Buffer.from(email).toString("base64");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: base64Email,
      },
    });
  }


  async createDraftWithAttachments(auth, gmailMessageData: gmailSenderTypes.GmailMessageData) {
    const gmail = google.gmail({ version: "v1", auth });
    console.log("This is the gmail message data:", gmailMessageData);
    console.log("This is the process.env.EMAIL_SMTP_USER_NAME:", process.env.EMAIL_SMTP_USER_NAME);
    console.log("This is the process.env.EMAIL_SMTP_USER:", process.env.EMAIL_SMTP_USER);

    // Create email boundary for multipart message
    const boundary = "boundary" + Date.now().toString();
  
    // Construct email headers
    const emailHeaders = [
      `From: "${process.env.EMAIL_SMTP_USER_NAME}" <${process.env.EMAIL_SMTP_USER}>`,
      `To: ${gmailMessageData.sendEmailTo}`,
      "MIME-Version: 1.0",
      `Subject: ${gmailMessageData.subject}`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      gmailMessageData.message,
    ];
  
    // Add attachments if they exist
    if (gmailMessageData.attachments && gmailMessageData.attachments.length > 0) {
      for (const attachment of gmailMessageData.attachments) {
        try {
          const fileContent = await fs.readFile(attachment.path);
          const mimeType = mime.lookup(attachment.path) || 'application/octet-stream';
          
          emailHeaders.push(`--${boundary}`);
          emailHeaders.push(`Content-Type: ${mimeType}`);
          emailHeaders.push('Content-Transfer-Encoding: base64');
          emailHeaders.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
          emailHeaders.push('');
          emailHeaders.push(fileContent.toString('base64').replace(/(.{76})/g, "$1\n"));
        } catch (error) {
          console.error(`Error processing attachment ${attachment.filename}:`, error);
          throw new Error(`Failed to process attachment ${attachment.filename}`);
        }
      }
    }
  
    // Add final boundary
    emailHeaders.push(`--${boundary}--`);
  
    // Create the email
    const email = emailHeaders.join("\r\n").trim();
    const base64Email = Buffer.from(email).toString("base64")
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  
    // Create the draft
    const draft = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: base64Email,
        },
      },
    });
  
    return draft.data;
  }



  async sendMailsWithAttachments(auth, gmailMessageData: gmailSenderTypes.GmailMessageData) {
    const gmail = google.gmail({ version: "v1", auth });

    // Create email boundary for multipart message
    const boundary = "boundary" + Date.now().toString();

    // Construct email headers
    const emailHeaders = [
      `From: "${process.env.EMAIL_SMTP_USER_NAME}" <${process.env.EMAIL_SMTP_USER}>`,
      `To: ${gmailMessageData.sendEmailTo}`,
      "MIME-Version: 1.0",
      `Subject: ${gmailMessageData.subject}`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      gmailMessageData.message,
    ];

    // Add attachments if they exist
    if (gmailMessageData.attachments && gmailMessageData.attachments.length > 0) {
      for (const attachment of gmailMessageData.attachments) {
        try {
          const fileContent = await fs.readFile(attachment.path);
          const mimeType = mime.lookup(attachment.path) || 'application/octet-stream';
          
          emailHeaders.push(`--${boundary}`);
          emailHeaders.push(`Content-Type: ${mimeType}`);
          emailHeaders.push('Content-Transfer-Encoding: base64');
          emailHeaders.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
          emailHeaders.push('');
          emailHeaders.push(fileContent.toString('base64').replace(/(.{76})/g, "$1\n"));
        } catch (error) {
          console.error(`Error processing attachment ${attachment.filename}:`, error);
          throw new Error(`Failed to process attachment ${attachment.filename}`);
        }
      }
    }
    // Add final boundary
    emailHeaders.push(`--${boundary}--`);
    // Create the email
    const email = emailHeaders.join("\r\n").trim();
    const base64Email = Buffer.from(email).toString("base64")
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: base64Email,
      },
    });
  }
}



@Injectable()
export class GoogleAuthService {
  private oauth2Client;
  private readonly SCOPES = SCOPES;

  constructor() {
    // console.log('GoogleAuthService constructor:', process.env.AUTH_GOOGLE_CLIENT_ID, process.env.AUTH_GOOGLE_CLIENT_SECRET, process.env.AUTH_GOOGLE_CALLBACK_URL);
    this.oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_CLIENT_ID,
      process.env.AUTH_GOOGLE_CLIENT_SECRET,
      process.env.AUTH_GOOGLE_CALLBACK_URL,
    );
  }

  async getAuthUrl(): Promise<string> {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent',
      include_granted_scopes: true
    });
  }

  async handleAuthCallback(code: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // Create token.json with the exact format Google expects
      const tokenData = {
        type: "authorized_user",
        client_id: process.env.AUTH_GOOGLE_CLIENT_ID,
        client_secret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        token_uri: "https://oauth2.googleapis.com/token",
        universe_domain: "googleapis.com"
      };

      await fs.writeFile('token.json', JSON.stringify(tokenData, null, 2));
      console.log('Token saved successfully to token.json');
      
      // Also save the full token response for debugging
      await fs.writeFile('token-full.json', JSON.stringify(tokens, null, 2));
      console.log('Full token response saved to token-full.json');
    } catch (error) {
      console.error('Error in handleAuthCallback:', error);
      throw error;
    }
  }
}
