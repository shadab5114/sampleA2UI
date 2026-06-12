const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Insert unpackA2uiData before export default function App
const unpackCode = `
function unpackA2uiData(data: any): any {
  if (data === null || data === undefined) return null;
  if (data instanceof Map) {
    const obj: any = {};
    data.forEach((value, key) => {
      obj[key] = unpackA2uiData(value);
    });
    return obj;
  }
  if (Array.isArray(data)) {
    return data.map(item => unpackA2uiData(item));
  }
  if (typeof data === 'object') {
    if (data.valueString !== undefined) return data.valueString;
    if (data.valueNumber !== undefined) return data.valueNumber;
    if (data.valueBoolean !== undefined) return data.valueBoolean;
    if (data.valueArray !== undefined) return unpackA2uiData(data.valueArray);
    if (data.valueMap !== undefined) return unpackA2uiData(data.valueMap);
    
    if (Array.isArray(data.valueMap)) {
      const obj: any = {};
      data.valueMap.forEach((pair: any) => {
        if (pair && pair.key !== undefined) {
          obj[pair.key] = pair.valueString ?? pair.valueNumber ?? pair.valueBoolean ?? unpackA2uiData(pair.valueMap ?? pair.valueArray);
        }
      });
      return obj;
    }
  }
  return data;
}
`;

content = content.replace(
  /export default function App\(\) \{/,
  unpackCode + '\nexport default function App() {'
);

// 2. Add updateDataModel polyfill to renderTestJson
const polyfillLogic = `
        if (msg.updateDataModel && msg.updateDataModel.contents) {
          const rootObj: any = {};
          msg.updateDataModel.contents.forEach((item: any) => {
             if (item.key) {
               rootObj[item.key] = unpackA2uiData(item.valueMap ?? item.valueArray ?? item.valueString ?? item.valueNumber ?? item.valueBoolean);
             }
          });
          msg.updateDataModel.path = ''; 
          msg.updateDataModel.value = rootObj;
          delete msg.updateDataModel.contents;
        }
`;

content = content.replace(
  /if \(msg\.updateComponents\?\.components\) \{/g,
  polyfillLogic + '\n        if (msg.updateComponents?.components) {'
);


fs.writeFileSync('src/App.tsx', content);
