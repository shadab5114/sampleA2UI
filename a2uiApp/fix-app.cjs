const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix deleteSurface
content = content.replace(/\{ deleteSurface: \{ surfaceId: s\.id \} \}/g, "{ version: 'v0.9', deleteSurface: { surfaceId: s.id } }");
content = content.replace(/\{ deleteSurface: \{ surfaceId \} \}/g, "{ version: 'v0.9', deleteSurface: { surfaceId } }");

// Remove stray setActiveSurfaceIds(new Set());
content = content.replace(/setActiveSurfaceIds\(new Set\(\)\);/g, "");

// Fix A2UIProvider and A2UIContextConsumer
content = content.replace(/<A2UIProvider onAction=\{handleAction\} theme=\{theme as any\}>\s*<A2UIContextConsumer/g, "<MainContent");
content = content.replace(/<\/A2UIContextConsumer>\s*<\/A2UIProvider>/g, "</MainContent>");

// Fix A2UIRenderer and activeSurfaceIds
content = content.replace(/\{Array\.from\(activeSurfaceIds\)\.map\(\(surfaceId: any\) => \(\s*<div key=\{surfaceId\} style=\{\{ marginBottom: '1\.5rem' \}\}>\s*<A2UIRenderer surfaceId=\{surfaceId\} \/>\s*<\/div>\s*\)\)\}/g, 
  `{surfaces.map((surface: any) => (
    <div key={surface.id} style={{ marginBottom: '1.5rem' }}>
      <A2uiSurface surface={surface} />
    </div>
  ))}`);

// Fix a2ui usage that should be processor
content = content.replace(/a2ui/g, "processor");

// Also, the previous script might not have passed the right props for 'processor' inside the processResponse calls.
// Wait, 'a2ui' was an argument to renderTestJson(a2ui: any). We changed it to renderTestJson(). 
// But inside renderTestJson, it still used 'a2ui.processMessages'. Let's replace 'a2ui.processMessages' with 'processor.processMessages'.
// The above replace /a2ui/g with "processor" will do exactly that, but let's be careful about strings. It's fine for this file.

fs.writeFileSync('src/App.tsx', content);
