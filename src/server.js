const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const session = require('express-session');
const { ClientId, ClientSecret, RedirectUri, ticketKey } = require('../config.js');
const dataStore = require('./dataStore.js');

const app = express();
const port = 8888;

app.use(session({
  secret: ClientSecret,
  resave: false,
  saveUninitialized: true
}));

async function openUrl(url) {
  const { default: open } = await import('open');
  open(url);
}

app.get('/login', (req, res) => {
  const scopes = 'user-top-read';
  const authUrl = `https://accounts.spotify.com/authorize?${querystring.stringify({
    response_type: 'code',
    client_id: ClientId,
    scope: scopes,
    redirect_uri: RedirectUri
  })}`;
  res.redirect(authUrl);
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Error logging out');
    }
    res.redirect('/login');
  });
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const tokenUrl = 'https://accounts.spotify.com/api/token';
  const response = await axios.post(tokenUrl, querystring.stringify({
    grant_type: 'authorization_code',
    code,
    redirect_uri: RedirectUri
  }), {
    headers: {
      'Authorization': `Basic ${Buffer.from(`${ClientId}:${ClientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  req.session.accessToken = response.data.access_token;
  req.session.save();

  const queryRequests = req.query;

  await getTopArtists(req.session.accessToken);
  await getEventList(req.query);
  res.redirect('/all-done');
});

app.get('/all-done', (req, res) => {
  res.json({status: 'ALL DONE!', topArtists: dataStore.getTopArtists(), eventList: dataStore.getEventList()});
})

app.get('/top-artists', async (req, res) => {
  res.json(dataStore.getTopArtists());
});

app.get('/event-list', async (req, res) => {
  res.json(dataStore.getEventList());
});

app.get('/temp', (req, res) => {
  const topArtists = dataStore.getTopArtists().items;
  const eventList = dataStore.getEventList();

  const artistNames = topArtists.map(artist => artist.name.toLowerCase());

  const filteredEvents = eventList.reduce((accumulator, event) => {
    const eventName = event.name.toLowerCase();
    const containsArtist = artistNames.some(artistName => eventName.includes(artistName));

    if (containsArtist) {
      console.log('Matching event:', event.name);
      accumulator.push({
        name: event.name,
        url: event.url
      });

    }
 
    return accumulator;
  }, []);
  
  console.log(filteredEvents);

  res.json(filteredEvents);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  openUrl(`http://localhost:${port}/login`);
});

async function getTopArtists(accessToken) {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/top/artists', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    dataStore.saveTopArtists(response.data);

    return response.data;
  } catch (error) {
    console.error('Error fetching top artists', error);
  }
}

async function getEventList(query) {
  const stateCode  = query.stateCode ? query.stateCode : null;
  try {
    const response = await axios.get(`https://app.ticketmaster.com/discovery/v2/events?apikey=${ticketKey}&locale=en-us&stateCode=MI&city=detroit&classificationName=music`);

    dataStore.saveEventList(response.data._embedded.events);

    return response.data._embedded.events;
  } catch (error) {
    console.error('Error fetching event list', error);
  }
}
