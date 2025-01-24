const fs = require('fs');

function extractPartNumbersAndSubOrders(jsonFilePath, outputFilePath) {
    fs.readFile(jsonFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        const jsonData = JSON.parse(data);
        const lines = jsonData.lines || [];
        const extractedData = lines.map((line) => ({
            ingramPartNumber: line.ingramPartNumber,
            subOrderNumber: line.subOrderNumber
        }));

        fs.writeFile(outputFilePath, JSON.stringify(extractedData, null, 4), 'utf8', (err) => {
            if (err) {
                console.error('Error writing the file:', err);
                return;
            }
            console.log('Part numbers and sub order numbers extracted successfully.');
        });
    });
}

const jsonFilePath =
    '/Users/brianff/MyFiles/DevFiles/nscatalyst/varconnect/varconnect-dev/PO9874-OrderDetailsV61.json';
const outputFilePath =
    '/Users/brianff/MyFiles/DevFiles/nscatalyst/varconnect/varconnect-dev/extracted_part_numbers_and_sub_orders.json';

extractPartNumbersAndSubOrders(jsonFilePath, outputFilePath);
