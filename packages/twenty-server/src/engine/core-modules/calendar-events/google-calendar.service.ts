// google-calendar.service.ts

import { Injectable } from '@nestjs/common';
import moment from 'moment';

import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import { env } from 'process';
import axios from 'axios';
import { CalendarEventType } from 'src/engine/core-modules/calendar-events/services/calendar-data-objects-types';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = process.cwd() + '/token.json';
const CREDENTIALS_PATH = process.cwd() + '/credentials.json';

@Injectable()
export class GoogleCalendarService {
  private oauth2Client;


  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_CLIENT_ID,
      process.env.AUTH_GOOGLE_CLIENT_SECRET,
      process.env.AUTH_GOOGLE_CALLBACK_URL,
    );
    // this.oauth2Client.setCredentials({
    //   access_token: 'YOUR_ACCESS_TOKEN',
    //   refresh_token: 'YOUR_REFRESH_TOKEN',
    //   scope: 'https://www.googleapis.com/auth/calendar',
    //   token_type: 'Bearer',
    //   //@ts-ignore
    //   expiry_date: moment().add(1, 'hour').unix(),
    // });
  }

  /**
   * Reads previously authorized credentials from the save file.
   *
   * @return {Promise<OAuth2Client|null>}
   */
  async loadSavedCredentialsIfExist() {
    try {
      const content = await fs.readFile(TOKEN_PATH);
      const credentials = JSON.parse(content.toString());
      return google.auth.fromJSON(credentials);
    } catch (err) {
      return null;
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
      type: 'authorized_user',
      client_id:  process.env.AUTH_GOOGLE_CLIENT_ID,
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
    if (client?.credentials) {
      await this.saveCredentials(client);
    }
    return client;
  }

  /**
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */
  async createEvent(auth, calendarEventData: CalendarEventType): Promise<void> {
    if(!auth?.credentials?.refresh_token) {
      throw new Error('No access token found');
    }
    try{
    const calendar = google.calendar({ version: 'v3', auth: auth });
    // const response = await axios.post('https://www.googleapis.com/calendar/v3/freeBusy', {
    //   items: [{ id: 'primary' }],
    //   timeMin: new Date().toISOString(),
    //   timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    // }, {
    //   headers: {
    //     Authorization: `Bearer ${auth?.credentials?.access_token}`,
    //   }
    // });
    let calendarEventDataObj = {
      ...calendarEventData,
      
    };

    if (calendarEventDataObj.typeOfMeeting === 'Virtual') {
      const randomString = (length = 10) => [...Array(length)].map(() => (Math.random().toString(36)[2])).join('')
      calendarEventDataObj = {
        ...calendarEventData,
        conferenceData: {
          createRequest: {
            requestId: randomString(),
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        }
      };
    }

 
      calendar.events.insert(
        {
          auth: auth,
          calendarId: 'primary',
          //@ts-ignore
          resource: calendarEventDataObj,
          conferenceDataVersion: 1,
        },
        function (err, event) {
          if (err) {
            console.log(
              'There was an error contacting the Calendar service: ' + err,
            );
            return;
          }
          console.log('Event created: %s', event.htmlLink);
        },
      );
    } catch (error) {
      throw new Error(`Error creating event: ${error.message}`);
    }
  }
}
