const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Replace customCatalog definition with appCatalog
content = content.replace(
  /const customCatalog = new Catalog\(\s*'local:custom',\s*\[Graph, KnowledgeGraph\],\s*\[\]\s*\);/,
  `const appCatalog = new Catalog(
  'basic',
  [...Array.from(basicCatalog.components.values()), Graph, KnowledgeGraph],
  basicCatalog.functions ? Array.from(basicCatalog.functions.values()) : []
);`
);

// 2. Update MessageProcessor initialization
content = content.replace(
  /const proc = new MessageProcessor\(\[basicCatalog, customCatalog\]/g,
  `const proc = new MessageProcessor([appCatalog]`
);

// 3. Update renderTestJson to inject catalogId
content = content.replace(
  /processorMessages\.forEach\(msg => \{\s*if \(msg\.updateComponents\?\.components\)/g,
  `processorMessages.forEach(msg => {
        if (msg.createSurface && !msg.createSurface.catalogId) {
          msg.createSurface.catalogId = 'basic';
        }
        if (msg.updateComponents?.components)`
);

// 4. Update processResponse to inject catalogId
content = content.replace(
  /newMessages\.push\(part\.data\);/g,
  `const msg = part.data;
            if (msg.createSurface && !msg.createSurface.catalogId) {
              msg.createSurface.catalogId = 'basic';
            }
            newMessages.push(msg);`
);

fs.writeFileSync('src/App.tsx', content);
