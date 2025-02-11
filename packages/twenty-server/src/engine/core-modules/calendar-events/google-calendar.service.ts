// google-calendar.service.ts

import { Injectable } from "@nestjs/common";
import moment from "moment";

import { promises as fs } from "fs";
import path from "path";
import process from "process";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";
import { env } from "process";
import axios from "axios";
import { CalendarEventType } from "src/engine/core-modules/calendar-events/services/calendar-data-objects-types";
import { graphqlQueryToGetCurrentUser } from "./services/graphql-queries-calendar";
import { axiosRequest } from "./utils/calendar-utils";
import { response } from "express";

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/calendar","https://www.googleapis.com/auth/contacts"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = process.cwd() + "/token.json";
const CREDENTIALS_PATH = process.cwd() + "/credentials.json";

@Injectable()
export class GoogleCalendarService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_CLIENT_ID,
      process.env.AUTH_GOOGLE_CLIENT_SECRET,
      process.env.AUTH_GOOGLE_CALLBACK_URL
    );
  }

  /**
   * Reads previously authorized credentials from the save file.
   *
   * @return {Promise<OAuth2Client|null>}
   */
  async loadSavedCredentialsIfExist(twenty_token: string) {

    const connectedAccountsResponse = await axios.request({
      method: "get",
      url: "http://localhost:3000/rest/connectedAccounts",
      headers: {
        authorization: "Bearer " + twenty_token,
        "content-type": "application/json",
      },
    });
    // console.log("connectedAccountsResponse::::", connectedAccountsResponse.data.data.connectedAccounts);
    // console.log("process.env.EMAIL_SMTP_USER::::", process.env.EMAIL_SMTP_USER);

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
  async authorize(twenty_token: string) {
    let client = await this.loadSavedCredentialsIfExist(twenty_token);
    if (client) {
      return client;
    }
    // @ts-ignore
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    if (client?.credentials) {
      await this.saveCredentials(client);
    }
    return client;
  }

  /**
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  async createEvent(auth, calendarEventData: CalendarEventType): Promise<object> {
    console.log("Going to create calendar event with details::", calendarEventData);
    if (!auth?.credentials?.refresh_token) {
      throw new Error("No access token found");
    }
    try {
      const calendar = google.calendar({ version: "v3", auth: auth });
      let calendarEventDataObj = {
        ...calendarEventData,
      };

      if (calendarEventDataObj.typeOfMeeting === "Virtual") {
        const randomString = (length = 10) =>
          [...Array(length)].map(() => Math.random().toString(36)[2]).join("");
        calendarEventDataObj = {
          ...calendarEventData,
          conferenceData: {
            createRequest: {
              requestId: randomString(),
              conferenceSolutionKey: {
                type: "hangoutsMeet",
              },
            },
          },
        };
      }



      calendar.events.insert(
        {
          auth: auth,
          calendarId: "primary",
          //@ts-ignore
          resource: calendarEventDataObj,
          conferenceDataVersion: 1,
        },
        function (err, event) {
          if (err) {
            console.log( "There was an error contacting the Calendar service: " + err );
            return;
          }
          console.log("Event created: %s", JSON.stringify(event));
          console.log("Event created: htmlLink%s", event.htmlLink);
        }
      );
      return { status: "Event created successfully" };
    } catch (error) {
      throw new Error(`Error creating event: ${error.message}`);
    }
  }


  async listEvents(auth: any, timeMin?: string, timeMax?: string) {
    if (!auth?.credentials?.refresh_token) {
      throw new Error("No access token found");
    }
  
    try {
      const calendar = google.calendar({ version: "v3", auth: auth });
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax || moment().add(7, 'days').toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
      });
  
      if (response.status !== 200) {
        throw new Error(`Failed to fetch events. Status: ${response.status}`);
      }
  
      return response.data.items;
    } catch (error) {
      console.error('Error listing calendar events:', error);
      throw new Error(`Error fetching calendar events: ${error.message}`);
    }
  }
}
