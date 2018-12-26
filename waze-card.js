/**
 * creates a lovelace card to show waze routes details
 */
class WazeCard extends HTMLElement {

  /**
   * called by hass - creates card, sets up any conmfig settings, and generates card
   * @param {Object} hass
   */
  set hass(hass) {
    this._hass = hass;

    this.getAllCalendarStates(this.config.calendars || [])
    .then(calendars => {
      const locationCalendars = calendars.filter(calendar => calendar.location);

      let isSomethingChanged = JSON.stringify(this.savedLocationCalendars || {}) !== JSON.stringify(locationCalendars);

      if(locationCalendars.length && isSomethingChanged) {

        this.savedLocationCalendars = locationCalendars;
        return this.convertLocationsToGeoCodes(locationCalendars);

      } else {
        return this.savedLocationCalendars || [];
      }
    })
    .then(calendarLocations => {
      const wazeStates = this.getAllStates(this.config.entities);

      const formattedCalendarLocations = this.formatCalendarEntities(calendarLocations);
      const nextStates = this.formatWazeEntities(wazeStates)

      console.log({nextStates, calendarLocations, wazeStates, formattedCalendarLocations});
      this.updateHtmlIfNecessary(nextStates);
    })
    .catch(error => console.log('error', error));
  }

  formatCalendarEntities(calendarLocations){
    return calendarLocations.map(cal => {
      return cal;
    });
  }

  formatWazeEntities(wazeStates){
    return wazeStates.map(state => {
      return {
        location: state.location,
        name: state.name || state.entity || '',
        distance: this.computeDistance(state),
        duration: this.computeDuration(state),
        route: state.attributes && state.attributes.route || ''
      };
    });
  }

  async convertLocationsToGeoCodes(locationCalendars){
    try {

      const allResults = await Promise.all(locationCalendars.map(async event => {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${event.location}&key=AIzaSyDPbGq-wyncMOVnM8BKn9dqP23DJ9qAOOU`
        const geoCode = await this.apiCall('POST', url);
        return {event, geoCode};
      }));

      console.log({allResults});

      return [].concat.apply([], allResults);

    } catch (error) {
      throw error;
    }
  }

  /**
   * [apiCall description]
   * @param  {[type]} requestType [description]
   * @param  {[type]} url         [description]
   * @return {[type]}             [description]
   */
  async apiCall(requestType, url){
    return new Promise((resolve, reject) => {
      var request = new XMLHttpRequest();
      request.open(requestType, url, true);

      request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
          var data = JSON.parse(request.responseText);
          return resolve(data);
        } else {
          reject(request);
        }
      };

      request.onerror = function(error) {
        reject(error);
      };

      request.send();
    })
  }

  /**
   * formats all states for this card to use for the HTML
   * @param {Array<Object>} entities  
   */
  getAllStates(entities){
    return entities
      .map(entity => {
        const state = this._hass.states[entity.entity || ''];
        const zone = this._hass.states[entity.zone || ''];

        if(state && zone) {
          state.name = entity.name || zone.attributes.friendly_name;
          state.location = {lat: zone.attributes.latitude, long:zone.attributes.longitude};
          return state;
        }
      })
      .filter(Boolean);
  }

  /**
   * [getAllCalendarStates description]
   * @param  {[type]} entities [description]
   * @return {[type]}          [description]
   */
  async getAllCalendarStates(entities) {

    // don't update if it's only been 15 min
    if(this.lastUpdate && moment().diff(this.lastUpdate, 'minutes') <= 15) {
      return this.calendarEvents;
    }
    
    const urls = this.createCalendarUrls(entities);
    return await this.getAllUrls(urls);
  }

  /**
   * generate calendar urls to get calendars
   * @param  {Array<string>} entities
   * @return {Array<string>}
   */
  createCalendarUrls(entities){

    // create url params
    let start = new Date();
    start = this.getFormattedDate(start);

    let end = new Date();
    end = this.addDays(end, this.config.numberOfDays);
    end = this.getFormattedDate(end);

    // generate urls for calendars and get each calendar data
    return entities.map(entity => `calendars/${entity}?start=${start}&end=${end}`);
  }

  /**
   * get date in YYYY-MM-DDTHH:MM:SST format
   * @param  {Date} date the date object to format
   * @return {string}
   */
  getFormattedDate(date){
    const month = ( '0' + (date.getMonth()+1) ).slice(-2);
    const day = ( '0' + date.getDate() ).slice(-2);
    const year = date.getFullYear();
    return `${year}-${month}-${day}T00:00:00Z`;
  }

  /**
   * [addDays description]
   * @param {Date} date the date object
   * @param {number} days number of days to add
   * @return {Date} new date object with days added
   */
  addDays(date, days) {
    let newDate = new Date(date.valueOf());
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  }

  /**
   * given a list of urls get the data from them
   * @param  {Array<string>} urls
   * @return {Array<any>}
   */
  async getAllUrls(urls) {
    try {
      const allResults = await Promise.all(urls.map(url => this._hass.callApi('get', url)));
      return [].concat.apply([], allResults);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates the HTML if anything has changed
   */
  updateHtmlIfNecessary(nextStates){
    
    // if data is the same as last time then do nothing
    if(JSON.stringify(nextStates) === JSON.stringify(this.currentStates || [])){
      return;
    }

    this.currentStates = nextStates;
    this.createCard();
  }

  /**
   * generates the duration for a route
   * @param  {Object} state the card state
   * @return {string} the formatted duration for a ruote
   */
  computeDuration(state){
    let duration = state.attributes && state.attributes.duration || 0;
    let unit_of_measurement = state.attributes && state.attributes.unit_of_measurement || '';
    return `${parseInt(duration)} ${unit_of_measurement}`;
  }

  /**
   * computes the distance for a route for metric/imperial system
   * @param  {Object} state the card state
   * @return {string} the formatted distance 
   */
  computeDistance(state){
    let distance = state.attributes && state.attributes.distance || 0;
    if(!this.config.metric) distance = distance/1.60934;

    distance = parseFloat(Math.round(distance * 100) / 100).toFixed(2);
    distance = this.config.metric ? `${distance}km` : `${distance}mi`;
    return distance;
  } 

  /**
   * generates the entire card and adds it to the dom
   */
  createCard(){
    this.content.innerHTML = this.cssRules;
    const stateTable = document.createElement('table');
    stateTable.classList.add('waze-card-route-table');

    const cardHeader = this.createCardHeader();
    if(cardHeader) stateTable.append(cardHeader);

    const cardBody = this.createCardBody();
    if(cardBody) stateTable.append(cardBody);
    
    this.content.append(stateTable);
  }

  /**
   * creates the table header
   * @return {HTMLElement} the table header element
   */
  createCardHeader(){
    if(!this.config.header) return;

    const stateHeader = document.createElement('thead');
    stateHeader.classList.add('waze-card-route-head');

    this.config.columns.forEach(column => {
        const stateRouteHeaderItem = document.createElement('th');
        stateRouteHeaderItem.classList.add('waze-card-route-head-item');
        stateRouteHeaderItem.setAttribute("align", "left");
        stateRouteHeaderItem.innerHTML = (column || '').toLowerCase();
        stateHeader.append(stateRouteHeaderItem);
    });

    return stateHeader;
  }

  /**
   * creates the table body and a row for each route
   * @return {HTMLElement} the table body element
   */
  createCardBody(){
    const stateBody = document.createElement('tbody');
    stateBody.classList.add('waze-card-route-body');
    
    this.currentStates.map(state => {
      const location = state.location && JSON.stringify(state.location);

      const stateRouteRow = document.createElement('tr');
      stateRouteRow.classList.add('waze-card-route-row');
      stateRouteRow.dataset.location = location;

      // for each value create a HTML column
      this.config.columns.forEach(column => {
        const stateRouteItem = document.createElement('td');
        stateRouteItem.classList.add('waze-card-route-item');
        
        stateRouteItem.innerHTML = (state[column] || '').toLowerCase();
        stateRouteItem.dataset.location = location;
        stateRouteRow.append(stateRouteItem);
      });

      stateBody.append(stateRouteRow);
    });

    return stateBody;
  }

  /**
   * merge the user configuration with default configuration and initialize card
   * @param {[type]} config [description]
   */
  setConfig(config) {
    if (!config.entities) {
      throw new Error('Entities list required.');
    }

    if(config.columns && !Array.isArray(config.columns)){
      throw new Error('columns config needs to be a list');
    }

    // setup conig
    this.config = {
      title: 'Waze Routes',
      group: false,
      header: true,
      metric: false,
      columns: ['name', 'distance', 'duration', 'route'],
      numberOfDays: 14,
      ...config
    };

    // create card
    const card = document.createElement('ha-card');
    if(this.config.title) card.header = `${this.config.title}`;
    this.content = document.createElement('div');

    // if not a part of a card group then add card padding
    if(!this.config.group){
      this.content.classList.add('waze-card-wrapper');
    }

    // add click event to open waze routes
    this.content.addEventListener('click', event => {
      const source = event.target || event.srcElement;
      if(!source || !source.dataset || !source.dataset.location) return;

      const location = JSON.parse(source.dataset.location);
      window.open(`https://www.waze.com/ul?navigate=yes&ll=${location.lat}%2C${location.long}`);
    });

    card.appendChild(this.content);
    this.appendChild(card);

    // save css rules
    this.cssRules = `
      <style>
        .waze-card-wrapper {
        }

        .waze-card-route-table {
          padding: 0 16px 10px;
              font-size: 1.1em;
        }

        .waze-card-route-head {
          padding: 0 16px 10px;
        }

        .waze-card-route-head-item {
          padding: 0 15px 0 0;
          text-transform: capitalize;
        }   

        .waze-card-route-body {
          cursor: pointer;
        }

        .waze-card-route-row {
        }

        .waze-card-route-item {
          text-transform: capitalize;
        }
      </style>
    `;
  }

  /**
   * get the size of the card
   * @return 1
   */
  getCardSize() {
    return 1;
  }
}
  
/**
 * add card definition to hass
 */
customElements.define('waze-card', WazeCard);