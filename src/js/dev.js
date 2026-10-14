// Landing HTML
const {createTab} = require('../js/tabs.js')

function createHtmlTab(htmlString, title = 'Landing Page') {
    const encodedHtml = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlString);
    createTab(encodedHtml, title);
    return encodedHtml;
}
