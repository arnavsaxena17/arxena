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
        responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted'
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

