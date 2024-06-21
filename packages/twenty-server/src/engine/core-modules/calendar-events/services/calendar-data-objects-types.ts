export interface CalendarEventType {
    summary: string,
    typeOfMeeting: string,
    location: string,
    description: string,
    start: {
        dateTime: string,
        timeZone: string
    },
    end: {
        dateTime: string,
        timeZone: string
    },
    attendees: {
        email: string
    }[],
    reminders: {
        useDefault: boolean,
        overrides: {
            method: string,
            minutes: number
        }[]
    },
    conferenceData?: {
        createRequest: {
            requestId: string,
            conferenceSolutionKey: {
                type: string
            }
        }
    }
}

