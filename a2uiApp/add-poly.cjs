const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// The polyfill function string
const polyfillCode = `
// Polyfill to auto-convert v0.8 payload syntax (literalString, explicitList, object component) to v0.9 schema
const convertV8toV9 = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(convertV8toV9);
  }

  // Handle v0.8 Component wrapping: { id: "...", component: { "Column": { ... } } }
  if (obj.id && obj.component && typeof obj.component === 'object' && Object.keys(obj.component).length === 1 && !obj.component.path && !obj.component.literalString && !obj.component.call) {
    const compName = Object.keys(obj.component)[0];
    const props = obj.component[compName] || {};
    
    return {
      id: obj.id,
      component: compName,
      weight: obj.weight,
      ...convertV8toV9(props)
    };
  }

  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (key === 'action' && obj[key] && obj[key].name) {
       // Convert v0.8 action array to v0.9 event object
       const actionObj = obj[key];
       const newContext: any = {};
       if (Array.isArray(actionObj.context)) {
         for (const item of actionObj.context) {
           if (item.key !== undefined && item.value !== undefined) {
             newContext[item.key] = convertV8toV9(item.value);
           }
         }
       }
       result[key] = { event: { name: actionObj.name, context: newContext } };
    } else {
       result[key] = convertV8toV9(obj[key]);
    }
  }

  // Unpack literals (v0.8 syntax)
  if (Object.keys(result).length === 1) {
    if ('literalString' in result) return result.literalString;
    if ('literalNumber' in result) return result.literalNumber;
    if ('literalBoolean' in result) return result.literalBoolean;
    if ('explicitList' in result) return result.explicitList;
  }

  return result;
};
`;

// Insert the polyfill before export default function App
content = content.replace(
  /export default function App\(\) \{/,
  polyfillCode + '\nexport default function App() {'
);

// Update renderTestJson mapping
content = content.replace(
  /msg\.updateComponents\.components = msg\.updateComponents\.components\.filter[\s\S]*?\n\s*\}/g,
  `msg.updateComponents.components = msg.updateComponents.components
            .filter((c: any) => c && c.id && c.component)
            .map(convertV8toV9);
        }`
);

// Update processResponse mapping
content = content.replace(
  /if \(msg\.updateComponents\?\.surfaceId\) \{/g,
  `if (msg.updateComponents?.components) {
              msg.updateComponents.components = msg.updateComponents.components
                .filter((c: any) => c && c.id && c.component)
                .map(convertV8toV9);
            }
            if (msg.updateComponents?.surfaceId) {`
);


fs.writeFileSync('src/App.tsx', content);
