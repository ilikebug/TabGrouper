// Refactored popup script
import { PopupManager } from '../js/modules/popupManager.js';

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});