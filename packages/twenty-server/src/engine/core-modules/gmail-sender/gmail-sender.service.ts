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

// If modifying these scopes, delete token.json.
const SCOPES = [
  // "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = process.cwd() + "/token.json";
const CREDENTIALS_PATH = process.cwd() + "/credentials.json";

@Injectable()
export class MailerService {
  private transporter;

  // constructor() {
  //   // this.transporter = nodemailer.createTransport({
  //   //   service: 'gmail',
  //   //   auth: {
  //   //     user: '',
  //   //     pass: 'your-email-password', // Use environment variables for security
  //   //   },
  //   // });
  // }

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
      scope: "https://www.googleapis.com/auth/gmail.send",
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
    // try {
    //   const content = await fs.readFile(TOKEN_PATH);
    //   const credentials = JSON.parse(content.toString());
    //   return google.auth.fromJSON(credentials);
    // } catch (err) {
    //   return null;
    // }

    const connectedAccountsResponse = await axios.request({
      method: "get",
      url: "http://localhost:3000/rest/connectedAccounts",
      headers: {
        authorization: "Bearer " + process.env.TWENTY_JWT_SECRET,
        "content-type": "application/json",
      },
    });

    if (connectedAccountsResponse?.data?.data?.connectedAccounts?.length > 0) {
      const refreshToken =
        connectedAccountsResponse?.data?.data?.connectedAccounts[0]
          ?.refreshToken;
      // const graphqlQueryObj2 = JSON.stringify({
      //   query: graphqlQueryToGetCurrentUser,
      //   variables: graphVariables,
      // });

      // const queryResponse2 = await axiosRequest(graphqlQueryObj);

      // const graphVariables2 = {
      //   objectRecordId: workspaceMemberId,
      // };

      // const refreshToken =
      //   queryResponse2?.data?.data?.workspaceMember?.connectedAccounts?.edges[0]
      //     ?.node?.refreshToken;
      debugger;
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
    // const content = await fs.readFile(CREDENTIALS_PATH);
    // const keys = JSON.parse(content.toString());
    // const key = keys.installed || keys.web;
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

    // const res = await gmail.users.messages.list({
    //   userId: 'me',
    //   maxResults: 10,
    // });

    // console.log(res.data);

    // const messages = res.data.messages;

    // for (const message of messages) {
    //   const msg = await gmail.users.messages.get({
    //     userId: 'me',
    //     id: message.id,
    //   });
    //   //@ts-ignore
    //   console.log(`Subject: ${msg.data.subject}`);
    // }
    const emailLines = [
      `From: "me"`,
      `To: ${gmailMessageData.sendEmailTo}`,
      "Content-type: text/html;charset=iso-8859-1",
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
}
