const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const config = require('../config/config');
const TokenModel = require('../model/Token')
const getOAuthUrl = require('../auth/auth')
const path = require('path');



// Home page or Login Page
router.get('/', (req, res) => {
    const redirectUrl = getOAuthUrl();
    res.write(`
        <h1>Welcome to the Google Drive Risk Report</h1>
        <a href="${redirectUrl}">Link your Google Drive account and generate report</a>
    `);
});


// This will redirect to the home page and show the report
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



// Home page or report page 
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

        let files = [];
        let nextPageToken = "";

        // Get the list of all files from the Google Drive API
        do{
            const response = await drive.files.list({
                pageSize: 1000,
                q: "'root' in parents and trashed = false",
                fields: 'nextPageToken, files(id, name, owners, shared, sharedWithMeTime, webViewLink, permissions, size)',
                pageToken: nextPageToken
            });
            files=[...files,...response.data.files];
            nextPageToken = response.data.nextPageToken;
        }while(nextPageToken);


        const totalFileAndFolderCount = files.length;
        let totalFileSize = 0;
        let totalExternalFileCount = 0;
        let totalPublicFileCount = 0;
        let peopleAccessedFiles = {};
        let riskFileCount = 0;
        let riskReport = [];

        for (const file of files) {
            if (file.size) {
                totalFileSize += Math.ceil((file.size) / (1024 * 1024));
            }

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

        console.log('People who have accessed your files:');
        for (const email in peopleAccessedFiles) {
            console.log(`${peopleAccessedFiles[email].name} (${email}): ${peopleAccessedFiles[email].count} times`);
        }


        if (totalFileAndFolderCount > 10) {
            riskFileCount += 10;
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
        riskScore = Math.ceil((riskFileCount / totalFileSize) * 100);
        
        let grade = "";
        if (riskScore >= 0 && riskScore <= 35) {
            grade = "Low";
        } if (riskScore >= 35 && riskScore <= 70) {
            grade = "Medium";
        } if(riskScore >= 70) {
            grade = "High";
        }

        console.log('Total file and folder count:', totalFileAndFolderCount);
        console.log('Total file size:', totalFileSize, 'MB');
        console.log('Total external file count:', totalExternalFileCount);
        console.log('Total public file count:', totalPublicFileCount);

        
        res.write(`
            <h1>Your Google Drive Risk Report</h1>
            <h2>Risk Score: ${riskScore}% <em>${grade}</em></h2>

            <h2>Risk Report:</h2>
            <p>Files that can contain malware:</p>
            <ul>
                ${riskReport.map((risk) => `<li>${risk}</li>`)}
            </ul>
            <li>Total file count: ${totalFileAndFolderCount}</li>
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


// Logout and redireced to login page
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