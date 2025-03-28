### Product Description: TabGrouper

**Overview:**
TabGrouper is a Chrome extension designed to help users organize their browser tabs into collections based on website domains. This tool simplifies tab management by automatically grouping tabs with the same domain, making it easier to navigate and manage multiple tabs.

**Features:**
1. **Automatic Tab Grouping:** Automatically groups tabs with the same domain into collections.
2. **Custom Host Names:** Allows users to set custom names for specific domains.
3. **Dynamic Host List:** Displays a dynamically updated list of supported host names and their custom names.
4. **User-Friendly Interface:** Provides an intuitive interface for setting custom host names and viewing current supported hosts.
5. **Storage Integration:** Saves and retrieves the list of supported host names using Chrome's local storage.

**Components:**
1. **Manifest File (`manifest.json`):**
   - Defines the extension's metadata, permissions, and background service worker.
   - Specifies the default popup (`popup/popup.html`) and icons.

2. **Popup HTML (`popup/popup.html`):**
   - Contains the user interface for setting custom host names and displaying the list of supported hosts.
   - Includes input fields for the domain and custom name, a set button, and a dynamically updated host list.

3. **Popup JavaScript (`popup/popup.js`):**
   - Manages the logic for saving and displaying supported host names.
   - Handles user interactions, such as setting custom host names and deleting existing ones.
   - Utilizes Chrome's local storage to persist the list of supported hosts.

**Usage:**
1. **Setting Custom Host Names:**
   - Open the TabGrouper popup by clicking the extension icon.
   - Enter the domain (e.g., `www.example.com`) and the desired custom name (e.g., `example`) in the input fields.
   - Click the "Set" button to save the custom host name.

2. **Viewing Supported Hosts:**
   - The popup displays a list of current supported host names, categorized by their custom names.
   - Each entry shows the domain and its custom name, with an option to delete the entry.

3. **Deleting Host Names:**
   - Click the delete button (✖) next to a host name to remove it from the list.
   - The list will be updated dynamically to reflect the changes.

**Technical Details:**
- **Languages:** JavaScript, HTML, CSS
- **Frameworks:** None
- **Permissions:** Requires access to active tabs, scripting, tab groups, bookmarks, and storage.
- **Storage:** Uses Chrome's local storage to save and retrieve the list of supported host names.

**Installation:**
1. Download the TabGrouper extension from the Chrome Web Store.
2. Click "Add to Chrome" to install the extension.
3. Access the extension by clicking the TabGrouper icon in the Chrome toolbar.

**Conclusion:**
TabGrouper is a powerful tool for users who frequently manage multiple tabs. By automatically grouping tabs based on domains and allowing custom naming, it enhances productivity and provides a cleaner browsing experience.


<img width="1920" alt="image" src="https://github.com/user-attachments/assets/43af2fce-5ab7-405a-bae0-b382b85474c7">
