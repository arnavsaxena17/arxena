import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";

import { Strategy, VerifyCallback } from "passport-google-oauth20";
import { Request } from "express";

import { EnvironmentService } from "src/engine/integrations/environment/environment.service";
import { CalendarChannelVisibility } from "src/modules/calendar/standard-objects/calendar-channel.workspace-entity";
import { MessageChannelVisibility } from "src/modules/messaging/common/standard-objects/message-channel.workspace-entity";

export type GoogleAPIsRequest = Omit<
  Request,
  "user" | "workspace" | "cacheVersion"
> & {
  user: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    picture: string | null;
    workspaceInviteHash?: string;
    accessToken: string;
    refreshToken: string;
    transientToken: string;
    redirectLocation?: string;
    calendarVisibility?: CalendarChannelVisibility;
    messageVisibility?: MessageChannelVisibility;
  };
};

export type GoogleAPIScopeConfig = {
  isCalendarEnabled?: boolean;
};

@Injectable()
export class GoogleAPIsStrategy extends PassportStrategy(
  Strategy,
  "google-apis"
) {
  constructor(
    environmentService: EnvironmentService,
    scopeConfig: GoogleAPIScopeConfig
  ) {
    console.log("GoogleAPIsStrategy.constructor()");
    const scope = ["email", "profile"];

    if (environmentService.get("MESSAGING_PROVIDER_GMAIL_ENABLED")) {
      console.log("Gmail enabled");
      scope.push("https://www.googleapis.com/auth/gmail.readonly");
      scope.push("https://www.googleapis.com/auth/gmail.send");
      scope.push("https://www.googleapis.com/auth/gmail.modify");
      scope.push("https://www.googleapis.com/auth/gmail.compose");
      scope.push("https://www.googleapis.com/auth/contacts");
      scope.push("https://www.googleapis.com/auth/drive");       
      scope.push("https://www.googleapis.com/auth/spreadsheets");
      scope.push("https://www.googleapis.com/auth/script.projects");
      scope.push("https://www.googleapis.com/auth/script.deployments");
      scope.push("https://www.googleapis.com/auth/script.external_request");
    }
    console.log("scopeConfig", scopeConfig);

    if (
      environmentService.get("CALENDAR_PROVIDER_GOOGLE_ENABLED") &&
      scopeConfig?.isCalendarEnabled
    ) {
      console.log("Cal enabled");
      scope.push("https://www.googleapis.com/auth/calendar.events");
    }
    console.log("environmentService.get('AUTH_GOOGLE_CLIENT_ID')", environmentService.get("AUTH_GOOGLE_CLIENT_ID"))
    console.log("environmentService.get('AUTH_GOOGLE_CLIENT_SECRET')", environmentService.get("AUTH_GOOGLE_CLIENT_SECRET"))
    console.log("environmentService.get('AUTH_GOOGLE_APIS_CALLBACK_URL')", environmentService.get("AUTH_GOOGLE_APIS_CALLBACK_URL"))
    super({
      clientID: environmentService.get("AUTH_GOOGLE_CLIENT_ID"),
      clientSecret: environmentService.get("AUTH_GOOGLE_CLIENT_SECRET"),
      callbackURL: environmentService.get("AUTH_GOOGLE_APIS_CALLBACK_URL"),
      scope,
      passReqToCallback: true,
    });
  }

  authenticate(req: any, options: any) {
    console.log("GoogleAPIsStrategy.authenticate()");
    console.log("GoogleAPIsStrategy.req.params()", req.params);
    console.log("GoogleAPIsStrategy.options", options);
    options = {
      ...options,
      accessType: "offline",
      prompt: "consent",
      state: JSON.stringify({
        transientToken: req.params.transientToken,
        redirectLocation: req.params.redirectLocation,
        calendarVisibility: req.params.calendarVisibility,
        messageVisibility: req.params.messageVisibility,
      }),
    };
    console.log("GoogleAPIsStrategy.options", options);

    return super.authenticate(req, options);
  }

  async validate(
    request: GoogleAPIsRequest,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback
  ): Promise<void> {
    console.log("GoogleAPIsStrategy.validate()");
    const { name, emails, photos } = profile;

    const state =
      typeof request.query.state === "string"
        ? JSON.parse(request.query.state)
        : undefined;

    const user: GoogleAPIsRequest["user"] = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos?.[0]?.value,
      accessToken,
      refreshToken,
      transientToken: state.transientToken,
      redirectLocation: state.redirectLocation,
      calendarVisibility: state.calendarVisibility,
      messageVisibility: state.messageVisibility,
    };

    done(null, user);
  }
}
