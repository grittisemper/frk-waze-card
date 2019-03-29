//import {Polymer} from "@polymer/polymer/polymer-legacy";

import { LitElement, html, } from 'https://unpkg-gcp.firebaseapp.com/@polymer/lit-element@0.5.2/lit-element.js?module';

//let LitElement = window.LitElement || Object.getPrototypeOf(customElements.get("hui-error-entity-row"));
// let html = LitElement.prototype.html;

function loadCSS(url) {
  const link = document.createElement('link');
  link.type = 'text/css';
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

//loadCSS( "/local/card-waze/waze-card.css" ) ;

// Create your custom component
class WazeCard extends LitElement {
  private currentStates ;

  private styles() {
    return html`
    <style>
      .ha-card-waze { /* Zebra striping */ }
      .ha-card-waze h3, h3 { padding-left: 10px ; padding-right: 10px ; margin-bottom: 0 ; color: white ; }
      .ha-card-waze table { width: 100%; }
      .ha-card-waze tr:nth-of-type(odd) { /*background: #eee; */ }
      .ha-card-waze th { /*background: #3498db;*/ color: white; font-weight: bold; }
      .ha-card-waze td { padding-left: 10px ; padding-right: 10px ; color: white ; text-align: left; }
      .ha-card-waze th { padding-left: 10px ; padding-right: 10px ; color: white ; text-align: left; }
    </style>
    `;
  }

  _render() {
    return html`
    <ha-card class="ha-card-waze">
        ${this.styles()}
        ${this.config.title.length > 0 ? html`<h2>${this.config.title}</h2>` : html`` }
        <table class="ha-card-waze">
            ${this.config.header ? html`
              <thead>${this.config.columns.map(column => html`<th>${(column || '').toLowerCase()}</th>`)}</thead>            
            ` : html`` }
            <tbody>
                ${this.currentStates ? this.currentStates.map( state => html`
                  <tr onclick="window.open('https://www.waze.com/ul?navigate=yes&ll=${state.destination.lat}%2C${state.destination.long}&from=${state.origin.lat}%2C${state.origin.long}&at=now');">
                    ${this.config.columns.map(column => html`
                      <td>${state[ column ]}</td>
                    `)}
                  </tr>
                `) : ''}
            </tbody>     
        </table>
    </ha-card>
    `;
  }

  getAllStates(entities) {
    const wazeStates = entities
      .map( entity => {
        const state = this._hass.states[entity.entity || ''];
        const origin = this._hass.states[entity.origin ] || { attributes : {latitude: this._hass.config.latitude, longitude: this._hass.config.longitude }};
        const destination = this._hass.states[entity.destination || ''];

        if(state && destination) {
          state.to_unit_system = entity.to_unit_system || this._hass.config.unit_system.length ;
          state.name = entity.name || destination.attributes.friendly_name;
          state.origin = {lat: origin.attributes.latitude, long: origin.attributes.longitude};
          state.destination = {lat: destination.attributes.latitude, long: destination.attributes.longitude};
          return state;
        }
      })
      .filter(Boolean);

    const nextStates = wazeStates.map(state => {
      return {
        origin: state.origin,
        destination: state.destination,
        name: state.name || state.entity || '',
        distance: this.computeDistance(state),
        duration: this.computeDuration(state),
        route: state.attributes && state.attributes.route || ''
      };
    });

    return( nextStates ) ;
  }

  /**
   * generates the duration for a route
   * @param  {Object} state the card state
   * @return {string} the formatted duration for a ruote
   */
  private computeDuration( state ) {
    let duration = state.attributes && state.attributes.duration || 0;
    let unit_of_measurement = state.attributes && state.attributes.unit_of_measurement || '';
    return `${parseInt(duration)} ${unit_of_measurement}`;
  }

  /**
   * computes the distance for a route for metric/imperial system
   * @param  {Object} state the card state
   * @return {string} the formatted distance
   */
  private computeDistance(state) {
    let distance = state.attributes && state.attributes.distance || 0;
    if(this._hass.config.unit_system.length !== state.to_unit_system ) {
      if( 'km' == state.to_unit_system ) {
        distance = distance / 1.60934 ;
      } else {
        distance = distance * 1.60934 ;
      }
    }

    distance = Number(Math.round(distance * 100) / 100).toFixed(1);
    distance = `${distance} ${this._hass.config.unit_system.length}`;
    return distance;
  }

  /**
   * System
   * @returns {{hass: ObjectConstructor; config: ObjectConstructor}}
   */
  static get properties() {
    return {
      hass: Object,
      config: Object,
    }
  }

  /**
   * System
   * @param config
   */
  setConfig(config) {
    if (!config.entities) {
      throw new Error('You need to define entities');
    }

    // setup config
    this.config = {
      title: 'Waze Routes',
      group: false,
      header: true,
      columns: ['name', 'distance', 'duration', 'route'],
      ...config
    };

    // add click event to open waze routes
    // this.getElementsByClassName( 'ha-card-waze' ).addEventListener('click', event => {
    //   const source = event.target || event.srcElement;
    //   if(!source || !source.dataset || !source.dataset.location) return;
    //
    //   const location = JSON.parse(source.dataset.location);
    //   window.open(`https://www.waze.com/ul?navigate=yes&ll=${location.lat}%2C${location.long}`);
    // });
    //this.config = config;
  }

  /**
   * Assign the external hass object to an internal class var.
   * This is called everytime a state change occurs in HA
   *
   * @param hass
   */
  set hass(hass) {
    this._hass = hass;

    const wazeStates = this.getAllStates( this.config.entities ) ;

    // if data is the same as last time then do nothing
    if(JSON.stringify(wazeStates) === JSON.stringify(this.currentStates || [])){
      return;
    }

    this.currentStates = wazeStates ;
  }

  /**
   * System
   * The height of your card. Home Assistant uses this to automatically
   * distribute all cards over the available columns.
   * @returns {any}
   */
  getCardSize() {
    return this.config.entities.length + 1;
  }
}

customElements.define('waze-card', WazeCard);