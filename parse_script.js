const fs = require('fs');
const content = fs.readFileSync('/Users/arnavsaxena/Downloads/problem.txt', 'utf8');

const startStr = 'window.__como_rehydration__ = ';
const idx = content.indexOf(startStr);
if (idx !== -1) {
  let endIdx = content.indexOf('</script>', idx);
  let scriptStr = content.substring(idx + startStr.length, endIdx);
  
  const searchStr = 'media.licdn.com/dms/image';
  let matchIdx = scriptStr.indexOf(searchStr);
  if (matchIdx !== -1) {
      console.log("SURROUNDING TEXT:");
      console.log(scriptStr.substring(matchIdx - 50, matchIdx + 300));
  }
}
