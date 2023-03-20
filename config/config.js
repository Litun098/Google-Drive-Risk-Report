require('dotenv').config();

module.exports = {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUrl: "http://localhost:5000/oauth2callback",
}
