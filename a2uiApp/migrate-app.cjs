const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Update imports
content = content.replace(
  /import \{ A2UIProvider, A2UIRenderer, useA2UI, ComponentRegistry \} from '@a2ui\/react\/v0_9';/,
  `import { A2uiSurface, basicCatalog } from '@a2ui/react/v0_9';
import { MessageProcessor, Catalog } from '@a2ui/web_core/v0_9';`
);

// 2. Update ComponentRegistry to Catalog
content = content.replace(
  /\/\/ Register custom visual components[\s\S]*?ComponentRegistry\.getInstance\(\)\.register\('KnowledgeGraph', \{ component: KnowledgeGraph \}\);/,
  `const customCatalog = new Catalog(
  'local:custom',
  [Graph, KnowledgeGraph],
  []
);`
);

// 3. Remove A2UIMessageHandler
content = content.replace(
  /function A2UIMessageHandler[\s\S]*?return null;\n\}/,
  ''
);

// 4. Update App()
content = content.replace(
  /export default function App\(\) \{[\s\S]*?const \[activeSurfaceIds, setActiveSurfaceIds\] = useState<Set<string>>\(new Set\(\)\);[\s\S]*?const \[pendingMessages, setPendingMessages\] = useState<any\[\]>\(\[\]\);/,
  `export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textResponse, setTextResponse] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  
  const [surfaces, setSurfaces] = useState<any[]>([]);
  
  const [processor] = useState(() => {
    const proc = new MessageProcessor([basicCatalog, customCatalog]);
    proc.onSurfaceCreated((surface) => {
      setSurfaces(prev => {
        const next = prev.filter(s => s.id !== surface.id);
        next.push(surface);
        return next;
      });
    });
    proc.onSurfaceDeleted((surfaceId) => {
      setSurfaces(prev => prev.filter(s => s.id !== surfaceId));
    });
    return proc;
  });
  
  useEffect(() => {
    // Action handler needs to be attached dynamically to avoid stale state if it depends on anything.
    // However, MessageProcessor provides a way to register an action listener if we need.
    // We'll just define it inline where we process messages or let the custom components emit standard context events.
  }, [processor]);`
);

// We need to also rename activeSurfaceIds usages inside processResponse
content = content.replace(
  /setActiveSurfaceIds\(prev => \{[\s\S]*?return updated;\n\s*\}\);/g,
  ''
);

// Remove setPendingMessages calls
content = content.replace(
  /if \(newMessages.length > 0\) \{\n\s*setPendingMessages\(newMessages\);\n\s*\}/g,
  `if (newMessages.length > 0) {
          processor.processMessages(newMessages);
        }`
);

// In handleSubmit
content = content.replace(
  /setPendingMessages\(\[\]\);/,
  `// setPendingMessages([]);`
);

// clearChat
content = content.replace(
  /setPendingMessages\(\[\]\);\n\s*setActiveSurfaceIds\(new Set\(\)\);/,
  `// Clear logic
    surfaces.forEach(s => processor.processMessages([{ deleteSurface: { surfaceId: s.id } }]));`
);

// Test Panel A2UI Process
content = content.replace(
  /const renderTestJson = \(a2ui: any\) => \{/,
  `const renderTestJson = () => {`
);
content = content.replace(
  /a2ui\.processMessages\(/g,
  `processor.processMessages(`
);
content = content.replace(
  /const clearTest = \(a2ui: any\) => \{/,
  `const clearTest = () => {`
);
content = content.replace(
  /const renderOpenJson = \(a2ui: any\) => \{/,
  `const renderOpenJson = () => {`
);
content = content.replace(
  /const clearOpenJson = \(a2ui: any\) => \{/,
  `const clearOpenJson = () => {`
);

// We still have activeSurfaceIds references in clearTest / clearOpenJson
content = content.replace(
  /activeSurfaceIds\.forEach\(surfaceId => \{/g,
  `surfaces.forEach(surface => { const surfaceId = surface.id;`
);

// Render A2UIContextConsumer
// We just need to move its return value into App's return value.
// Actually, it's easier to keep the function A2UIContextConsumer signature, but pass `processor`, `surfaces` and change its name to `MainContent`.
content = content.replace(
  /function A2UIContextConsumer/g,
  `function MainContent`
);
content = content.replace(
  /const a2ui = useA2UI\(\);/,
  ``
);
content = content.replace(
  /<A2UIMessageHandler[\s\S]*?\/>/,
  ``
);

// The surface container in MainContent
// Find `<div className="right-panel">` or similar where A2UIRenderer was.
// Oh wait, A2UIRenderer is probably rendered somewhere in the file. Let's find it.
content = content.replace(
  /\{Array\.from\(activeSurfaceIds\)\.map\(id => \(\s*<A2UIRenderer key=\{id\} surfaceId=\{id\} \/>\s*\)\)\}/g,
  `{surfaces.map(surface => (
    <div key={surface.id} className="surface-wrapper" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <A2uiSurface surface={surface} />
    </div>
  ))}`
);

// Update A2UIProvider
content = content.replace(
  /<A2UIProvider onAction=\{handleAction\} theme=\{theme as any\}>\n\s*<MainContent/,
  `<MainContent`
);
content = content.replace(
  /<\/MainContent>\n\s*<\/A2UIProvider>/,
  `</MainContent>`
);

// Change App's return
content = content.replace(
  /<A2UIProvider onAction=\{handleAction\} theme=\{theme as any\}>\n\s*<MainContent/g,
  `<MainContent`
);
content = content.replace(
  /<\/MainContent>\n\s*<\/A2UIProvider>/g,
  `</MainContent>`
);

// Pass surfaces and processor to MainContent
content = content.replace(
  /activeSurfaceIds=\{activeSurfaceIds\}\n\s*setActiveSurfaceIds=\{setActiveSurfaceIds\}\n\s*pendingMessages=\{pendingMessages\}\n\s*setPendingMessages=\{setPendingMessages\}/g,
  `surfaces={surfaces} processor={processor}`
);
// In MainContent props definition
content = content.replace(
  /activeSurfaceIds, setActiveSurfaceIds, pendingMessages,/g,
  `surfaces, processor,`
);

fs.writeFileSync('src/App.tsx', content);
