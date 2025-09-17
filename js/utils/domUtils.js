// DOM utilities
import { CONFIG } from '../constants/config.js';

/**
 * Gets favicon URL for a given URL
 * @param {string} url - The URL to get favicon for
 * @returns {string} - The favicon URL
 */
export function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}/favicon.ico`;
  } catch (e) {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}`;
    } catch (error) {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23ccc"/></svg>';
    }
  }
}

/**
 * Creates a favicon image element
 * @param {string} url - The URL to get favicon for
 * @param {string} fallbackIcon - Fallback icon text
 * @returns {HTMLElement} - The favicon element
 */
export function createFaviconElement(url, fallbackIcon = CONFIG.DEFAULT_ICONS.SEARCH) {
  const icon = document.createElement('img');
  icon.src = getFaviconUrl(url);
  icon.style.width = '16px';
  icon.style.height = '16px';
  icon.style.marginRight = '5px';
  
  icon.onerror = () => {
    icon.style.display = 'none';
    const fallback = document.createElement('span');
    fallback.textContent = fallbackIcon;
    fallback.style.marginRight = '5px';
    icon.parentNode?.insertBefore(fallback, icon);
  };
  
  return icon;
}

/**
 * Creates a delete button element
 * @param {Function} onClickHandler - Click handler function
 * @returns {HTMLElement} - The delete button element
 */
export function createDeleteButton(onClickHandler) {
  const button = document.createElement('button');
  button.className = CONFIG.CSS_CLASSES.DELETE_BUTTON;
  button.textContent = CONFIG.DEFAULT_ICONS.DELETE;
  
  if (onClickHandler) {
    button.addEventListener('click', onClickHandler);
  }
  
  return button;
}

/**
 * Removes an element by ID if it exists
 * @param {string} elementId - The ID of the element to remove
 * @returns {boolean} - Whether the element was removed
 */
export function removeElementById(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.remove();
    return true;
  }
  return false;
}

/**
 * Debounce function to limit the rate of function calls
 * @param {Function} func - The function to debounce
 * @param {number} wait - The wait time in milliseconds
 * @returns {Function} - The debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}