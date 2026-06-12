const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace splitMegaMessages
content = content.replace(
  /const splitMegaMessages = \(\s*messages:\s*any\[\]\s*\):\s*any\[\] => \{[\s\S]*?return result;\s*\};/,
  `const splitMegaMessages = (messages: any[]): any[] => {
  const result: any[] = [];
  const keys = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'];
  
  for (const msg of messages) {
    const activeKeys = keys.filter(k => msg[k] !== undefined);
    if (activeKeys.length > 0) {
      for (const key of activeKeys) {
        const payload = msg[key];
        
        // Handle v0.8 updateDataModel contents array
        if (key === 'updateDataModel' && payload.contents && Array.isArray(payload.contents)) {
          for (const item of payload.contents) {
            if (item.key) {
              const val = unpackA2uiData(item.valueMap ?? item.valueArray ?? item.valueString ?? item.valueNumber ?? item.valueBoolean);
              result.push({
                version: 'v0.9',
                updateDataModel: {
                  surfaceId: payload.surfaceId,
                  path: '/' + item.key,
                  value: val
                }
              });
            }
          }
        } else {
          result.push({ version: 'v0.9', [key]: payload });
        }
      }
    } else {
      msg.version = 'v0.9';
      result.push(msg);
    }
  }
  return result;
};`
);

// Remove the old polyfill logic from the two loops:
//        if (msg.updateDataModel && msg.updateDataModel.contents) { ... }
content = content.replace(
  /if \(msg\.updateDataModel && msg\.updateDataModel\.contents\) \{[\s\S]*?delete msg\.updateDataModel\.contents;\s*\}/g,
  ``
);


fs.writeFileSync('src/App.tsx', content);
