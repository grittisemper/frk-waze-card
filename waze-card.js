/**
 * 
 */
class WazeCard extends HTMLElement {

    /**
     * called by hass - creates card, sets up any conmfig settings, and generates card
     * @param  {[type]} hass [description]
     * @return {[type]}      [description]
     */
    set hass(hass) {
      // if we don't have the card yet then create it
      if (!this.content) {

        if(!Array.isArray(this.config.values)){
          throw new Error('values config needs to be a list');
        }

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
  
        this._hass = hass;
    
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
            }

            .waze-card-route-row {
            }

            .waze-card-route-item {
              text-transform: capitalize;
            }
          </style>
        `;
      }

      // update card
      const wazeStates = this.getAllStates(this.config.entities);
      this.updateHtmlIfNecessary(wazeStates);
    }

    /**
     *
     */
    getAllStates(entities){
      return entities
        .map(entity => {
          const state = this._hass.states[entity.entity];
          if(state) state.name = entity.name;
          
          const zone = this._hass.states[entity.zone];
          if(zone) state.location = {lat: zone.attributes.latitude, long:zone.attributes.longitude};

          return state;
        })
        .filter(Boolean);
    }

    /**
     * [updateHtmlIfNecessary description]
     * @param  {[type]} wazeStates [description]
     * @return {[type]}            [description]
     */
    updateHtmlIfNecessary(wazeStates){
      const nextStates = wazeStates.map(state => {

        return {
          location: state.location,
          name: state.name || state.entity || '',
          distance: this.computeDistance(state),
          duration: this.computeDuration(state),
          route: state.attributes && state.attributes.route || ''
        };
      });

      // if data is the same as last time then do nothing
      if(JSON.stringify(nextStates) === JSON.stringify(this.currentStates || [])){
        return;
      }

      this.currentStates = nextStates;
      this.createCard();
    }

    /**
     * [computeDuration description]
     * @param  {[type]} state [description]
     * @return {[type]}       [description]
     */
    computeDuration(state){
      let duration = state.attributes && state.attributes.duration || 0;
      let unit_of_measurement = state.attributes && state.attributes.unit_of_measurement || '';
      return `${parseInt(duration)} ${unit_of_measurement}`;
    }

    /**
     * 
     * @param  {[type]} distance [description]
     * @return {[type]}          [description]
     */
    computeDistance(state){
      let distance = state.attributes && state.attributes.distance || 0;
      if(!this.config.metric) distance = distance/1.60934;

      distance = parseFloat(Math.round(distance * 100) / 100).toFixed(2);
      distance = this.config.metric ? `${distance}km` : `${distance}mi`;
      return distance;
    } 

    /**
     * [createCard description]
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
     * [createCardHeader description]
     */
    createCardHeader(){
      if(!this.config.header) return;

      const stateHeader = document.createElement('thead');
      stateHeader.classList.add('waze-card-route-head');

      this.config.values.forEach(column => {
          const stateRouteHeaderItem = document.createElement('th');
          stateRouteHeaderItem.classList.add('waze-card-route-head-item');
          stateRouteHeaderItem.setAttribute("align", "left");
          stateRouteHeaderItem.innerHTML = (column || '').toLowerCase();
          stateHeader.append(stateRouteHeaderItem);
      });

      return stateHeader;
    }

    /**
     * [createCardBody description]
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
        this.config.values.forEach(column => {
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
     * merge the user configuration with default configuration
     * @param {[type]} config [description]
     */
    setConfig(config) {
      if (!config.entities) {
        throw new Error('');
      }
  
      this.config = {
        title: 'Waze Routes',
        group: false,
        header: true,
        metric: false,
        values: ['name', 'distance', 'duration', 'route'],
        ...config
      };
    }
  
    /**
     * get the size of the card
     * @return {[type]} [description]
     */
    getCardSize() {
      return 3;
    }
}
  
  
  /**
   * add card definition to hass
   */
  customElements.define('waze-card', WazeCard);