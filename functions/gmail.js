require("dotenv").config()
const { google } = require('googleapis')
const cheerio = require('cheerio')

 const getEmailHtmlBody = (message)=> {
    const { parts } = message.data.payload;
    let emailBody = '';

    for (const part of parts) {
        if (part.mimeType === 'text/html') {
            emailBody = part.body.data;
            break;
        }
    }

    return Buffer.from(emailBody, 'base64')
}

const getNews = (message) => {
    const body = getEmailHtmlBody(message)
    const $ = cheerio.load(body)
    const paragraphs = [];

    $('p').each((i, p) => {
      const paragraph = {};
      const strong = $(p).find('strong');
      if (strong.length > 0) {
        paragraph.title = strong.text().split(':')[0];
      }
      paragraph.text = $(p).text().replace(paragraph.title, '').replace('\\n', '').replace(':', '').trim();
      paragraphs.push(paragraph);
    });
    return paragraphs
}

const getAuth = () => {
    const oAuth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        process.env.REDIRECT_URI
    );

    oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
return oAuth2Client
}
const getLastMessage = async () => {
    const auth = getAuth()
    const gmail = google.gmail({ version: 'v1', auth });
    // Search for emails in the inbox
    const result = await gmail.users.messages.list({
        userId: 'me',
        q: 'from:newsletter@filipedeschamps.com.br',
        maxResults: 1
    });
    const message = result.data.messages[0];
    if (!message) {
        console.log('No matching email found');
        return;
    }
    return gmail.users.messages.get({
        userId: 'me',
        id: message.id,
    });
}
exports.handler = async (event) => {
    const message = await getLastMessage()
    const news = getNews(message)
    const body = JSON.stringify({
        date: new Date(parseInt(message.data.internalDate)).toISOString(),
        news
    })
    
    return {
        statusCode: 200,
        body,
        headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Access-Control-Allow-Origin': '*',
		},
    }
}