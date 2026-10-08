const fs = require('fs');
const path = require('path');

const mockPath = path.join(__dirname, 'src/data/mockData.js');
let content = fs.readFileSync(mockPath, 'utf8');

let step = 1;
content = content.replace(/Leakage_Current_mA:\s*\d+\.\d+,/g, () => {
    let val = 82 + step;
    step++;
    return `Leakage_Current_mA: ${val}.0,`;
});

step = 1;
content = content.replace(/forecast_condition:\s*"CRITICAL"/g, () => {
    let cond = step > 7 ? '"CRITICAL"' : '"WARNING"';
    step++;
    return `forecast_condition: ${cond}`;
});

fs.writeFileSync(mockPath, content);
console.log('Successfully updated mockData.js');
