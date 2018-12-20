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
        const card = document.createElement('ha-card');
        card.header = this.config.title;
        this.content = document.createElement('div');
        this.content.style.padding = '0 16px 10px';
        card.appendChild(this.content);
        this.appendChild(card);
      }
  
      // save an instance of hass for later
      this._hass = hass;
  
      // save css rules
      this.cssRules = `
      
      `;
  
      // update card
      this
        .getAllEvents(this.config.entities)
        .then(events => this.updateHtmlIfNecessary(events))
        .catch(error => console.log('error', error));
    }

    getAllEvents(entities){
        return new Promise((resolve, reject) => {
            console.log(entities, this.config)
            return resolve();
        });
    }

    updateHtmlIfNecessary(events){

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
        title: '',
        
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