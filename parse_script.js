const fs = require('fs');
const content = fs.readFileSync('/Users/arnavsaxena/Downloads/problem.txt', 'utf8');

const regex = /\\"rootUrl\\":\\"([^\\"]+)\\",\\"imageRenditions\\":\[\{\\"width\\":[^,]+,\\"height\\":[^,]+,\\"suffixUrl\\":\\"([^\\"]+)\\"/g;

let match;
let count = 0;
while ((match = regex.exec(content)) !== null) {
    count++;
    console.log("Found:", match[1] + match[2]);
}
console.log("Total found:", count);
