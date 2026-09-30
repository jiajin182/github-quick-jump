'use strict';

document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
