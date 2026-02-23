const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GoogleCalendarService {
    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
    }

    // Generate Auth URL for a doctor
    getAuthUrl(workspaceId) {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/calendar'],
            state: workspaceId
        });
    }

    // Get tokens from code
    async getTokens(code) {
        const { tokens } = await this.oauth2Client.getToken(code);
        return tokens;
    }

    // Book an appointment
    async createEvent(tokens, { summary, startDateTime, endDateTime, patientPhone }) {
        this.oauth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

        const event = {
            summary: `كشف: ${summary}`,
            description: `رقم المريض: ${patientPhone}`,
            start: { dateTime: startDateTime, timeZone: 'Africa/Cairo' },
            end: { dateTime: endDateTime, timeZone: 'Africa/Cairo' },
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });

        return response.data;
    }

    // List upcoming slots
    async listSlots(tokens) {
        this.oauth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        });

        return res.data.items;
    }
}

module.exports = new GoogleCalendarService();
