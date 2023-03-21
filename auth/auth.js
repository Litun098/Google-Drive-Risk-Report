const {google} = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const config = require('../config/config');

// Function to generate OAuth URL
module.exports = function getOAuthUrl() {
    const oauth2Client = new OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUrl,
    );

    const scopes = [
        'https://www.googleapis.com/auth/drive',
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes
    });
}