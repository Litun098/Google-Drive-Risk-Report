#### Google Drive Risk Report

Google Drive Risk Report is a web-based application that analyzes your Google Drive and generates a report of potential security risks in your files. The application uses the Google Drive API to retrieve data about your files, including the number of files, total file size and the creation date.


## Installation and Usage

## Prerequisites

Node.js version 14 or higher
MongoDB database

## Install dependencies

```bash
    npm install
```

## Configure environment variables

Create a .env file in the root directory and configure the following variables:

```bash
    DATABASE_URL=mongodb://localhost:27017/google-drive-risk-report
    CLIENT_ID=YOUR_CLIENT_ID
    CLIENT_SECRET=YOUR_CLIENT_SECRET
    REDIRECT_URL=http://localhost:5000/oauth2callback
```
Replace YOUR_CLIENT_ID and YOUR_CLIENT_SECRET with your own Google API keys.

## Start the server

```bash
    npm start
```

## Link your Google Drive account and generate report

Open a web browser and navigate to http://localhost:5000/. Click on Link your Google Drive account and generate report and follow the prompts to authorize the application to access your Google Drive. Once authorized, the application will analyze your files and generate a risk report.

## Contributing

Contributions are welcome! To contribute, please fork the repository, make changes, and submit a pull request.

