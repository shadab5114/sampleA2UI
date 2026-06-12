const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Insert splitMegaMessages function before export default function App
const splitCode = `
// Helper to split v0.8 mega-messages (which contained createSurface AND updateComponents together) into valid v0.9 individual messages
const splitMegaMessages = (messages: any[]): any[] => {
  const result: any[] = [];
  const keys = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'];
  
  for (const msg of messages) {
    const activeKeys = keys.filter(k => msg[k] !== undefined);
    if (activeKeys.length > 1) {
      for (const key of activeKeys) {
        result.push({ version: 'v0.9', [key]: msg[key] });
      }
    } else {
      msg.version = 'v0.9';
      result.push(msg);
    }
  }
  return result;
};
`;

content = content.replace(
  /export default function App\(\) \{/,
  splitCode + '\nexport default function App() {'
);

// 2. Update renderTestJson
// Find: // Validate component structures
// Add: processorMessages = splitMegaMessages(processorMessages);
content = content.replace(
  /\/\/\s*Validate component structures\s*processorMessages\.forEach/g,
  `// Validate component structures\n      processorMessages = splitMegaMessages(processorMessages);\n      processorMessages.forEach`
);

// 3. Update processResponse
// In processResponse, we previously pushed part.data to newMessages and directly modified it inside the push loop.
// Let's replace the inner part of parts.forEach in processResponse:

content = content.replace(
  /const msg = part\.data;\s*if \(msg\.createSurface && !msg\.createSurface\.catalogId\) \{\s*msg\.createSurface\.catalogId = 'basic';\s*\}\s*newMessages\.push\(msg\);\s*\/\/ Track active surface IDs/g,
  `newMessages.push(part.data);\n            \n            // Track active surface IDs`
);

// Now find where newMessages is sorted and add splitMegaMessages
content = content.replace(
  /if \(newMessages\.length > 0\) \{\s*newMessages\.sort\(\(a, b\) => \{/g,
  `if (newMessages.length > 0) {
          newMessages = splitMegaMessages(newMessages);
          newMessages.forEach(msg => {
            if (msg.createSurface && !msg.createSurface.catalogId) {
              msg.createSurface.catalogId = 'basic';
            }
          });
          newMessages.sort((a, b) => {`
);


fs.writeFileSync('src/App.tsx', content);
