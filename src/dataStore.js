
module.exports = {
    saveTopArtists,
    getTopArtists,
    saveEventList,
    getEventList
}

let topArtists;
let eventList;

function saveTopArtists(artists) {
    topArtists = artists;
}

function saveEventList(list) {
    eventList = list;
}

function getTopArtists() {
    return topArtists;
}

function getEventList() {
    return eventList;
}