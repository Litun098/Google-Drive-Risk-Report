const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const config = require('../config/config');
const TokenModel = require('../model/Token')
const path = require('path');

// Function to generate OAuth URL
function getOAuthUrl() {
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

// Home page or Login Page
router.get('/', (req, res) => {
    const redirectUrl = getOAuthUrl();
    res.write(`
        <h1>Welcome to the Google Drive Risk Report</h1>
        <a href="${redirectUrl}">Link your Google Drive account and generate report</a>
    `);
});

router.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;

    const oauth2Client = new OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUrl,
    );

    const { tokens } = await oauth2Client.getToken(code);

    const expiryDate = Date.now() * 1000;

    // Store token in MongoDB database
    await TokenModel.findOneAndUpdate({}, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: expiryDate,
        token_type: tokens.token_type,
    }, { upsert: true });

    res.redirect('/home');
});




router.get('/home', async (req, res) => {
    try {
        const token = await TokenModel.findOne();

        if (!token) {
            res.redirect('/');
        }

        const oauth2Client = new OAuth2(
            config.clientId,
            config.clientSecret,
            config.redirectUrl,
        );

        oauth2Client.setCredentials({
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            expiry_date: token.expiry_date,
            token_type: token.token_type,
        });

        const drive = google.drive({
            version: 'v3',
            auth: oauth2Client,
        });

        // Get the list of all files from the Google Drive API
        const response = await drive.files.list({
            pageSize: 1000,
            q: "'root' in parents and trashed = false",
            fields: 'nextPageToken, files(id, name, owners, shared, sharedWithMeTime, webViewLink, permissions)',
        });


        const files = response.data.files;

        // Initialize the counters
        let totalFileCount = 0;
        let totalFileSize = 0;
        let totalExternalFileCount = 0;
        let totalPublicFileCount = 0;
        let riskReport = [];
        let riskFileCount = 0;
        let totalRiskFileSize = 0;
        let fileCount = 0;
        const peopleAccessedFiles = {};

        // Iterate through each file and update the counters and peopleAccessedFiles object
        for (const file of files) {
            totalFileCount++;
            totalFileSize += Math.round((file.size) / (1024 * 1024));

            if (file.shared) {
                totalExternalFileCount++;
            }

            if (file.permissions) {
                for (const permission of file.permissions) {
                    if (permission.type === 'anyone' && permission.role === 'reader') {
                        totalPublicFileCount++;
                    } else if (permission.emailAddress && permission.lastModifyingUser) {
                        if (!peopleAccessedFiles[permission.emailAddress]) {
                            peopleAccessedFiles[permission.emailAddress] = {
                                name: permission.lastModifyingUser.displayName,
                                count: 1,
                            };
                        } else {
                            peopleAccessedFiles[permission.emailAddress].count++;
                        }
                    }
                }
            }
        }
        if (totalFileCount > 10) {
            riskFileCount += 100;
        }
        

        files.forEach((file) => {
    
            const fileExtension = path.extname(file.name);

            // Create simple risk report based off file extension
            if (fileExtension === '.exe') {
                riskReport.push(`${file.name}`);
            } else if (fileExtension === '.pdf' || fileExtension === '.txt' && parseInt(file.size) > 500) {
                riskReport.push(`${file.name}`);
            } else if (fileExtension === '.doc' || fileExtension === '.docx') {
                riskReport.push(`${file.name}`);
            }
        });

        
        // Count Totoal Risk Score
        riskScore = Math.ceil(((totalRiskFileSize * riskFileCount) / totalFileSize) * 100);


        let grade = "";
        if (riskScore >= 0 && riskScore <= 35) {
            grade = "Low";
        } if (riskScore >= 35 && riskScore <= 70) {
            grade = "Medium";
        } else {
            grade = "High";
        }

        res.write(`
            <h1>Your Google Drive Risk Report</h1>
            <h2>Risk Score: ${riskScore}% <em>${grade}</em></h2>

            <h2>Risk Report:</h2>
            <p>Files that can contain malware:</p>
            <ul>
                ${riskReport.map((risk) => `<li>${risk}</li>`)}
            </ul>
            <li>Total file count: ${totalFileCount}</li>
            <li>Total file size: ${totalFileSize} MB</li>
            <li>Total number of files shared externally: ${totalExternalFileCount}</li>
            <li>Total number of public files available via link: ${totalPublicFileCount}</li>
            <li>Total number of people having access to files: ${Object.keys(peopleAccessedFiles).length}</li>
        </ul>


        <h2>People who have accessed your files:</h2>
        <ul>
            ${Object.keys(peopleAccessedFiles).map((email) => `
                <li>
                    <strong>${peopleAccessedFiles[email].name} (${email}):</strong>
                    access: ${peopleAccessedFiles[email].accessCount} times
                </li>
            `)}
        </ul>
            
            
        <a href="/revoke">Logout</a>
        `)

    } catch (error) {
        console.error(error);
        res.status(500).send('Error occurred while retrieving Google Drive analytics');
    }
});


router.get('/auth/google', (req, res) => {
    const oauth2Client = new OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUrl,
    );
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: config.scopes,
    });

    res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
    const oauth2Client = new OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUrl,
    );
    try {
        const { tokens } = await oauth2Client.getToken(req.query.code);

        await TokenModel.deleteMany();
        await new TokenModel(tokens).save();

        res.redirect('/home');
    } catch (err) {
        console.log(err);
        res.redirect('/');
    }
});

router.get('/revoke', async (req, res) => {
    try {
        const token = await TokenModel.findOne();

        if (!token) {
            return res.redirect('/');
        }

        const oauth2Client = new OAuth2(
            config.clientId,
            config.clientSecret,
            config.redirectUrl,
        );

        oauth2Client.setCredentials({
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            expiry_date: token.expiry_date,
            token_type: token.token_type,
        });

        await oauth2Client.revokeToken(token.access_token);

        await TokenModel.deleteMany();

        res.redirect('/');
    } catch (err) {
        console.log(err);
        res.redirect('/');
    }
});


module.exports = router