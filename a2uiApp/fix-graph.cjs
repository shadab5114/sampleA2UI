const fs = require('fs');

// Fix Graph.tsx
let graphContent = fs.readFileSync('src/components/Graph.tsx', 'utf8');

graphContent = graphContent.replace(
  /export default createBinderlessComponentImplementation\(GraphApi, \(\{ context \}\) => \{[\s\S]*?const ctx = canvasRef\.current\.getContext\('2d'\);\s*if \(!ctx\) return;\s*if \(chartRef\.current\) \{\s*chartRef\.current\.destroy\(\);\s*\}/,
  `export default createBinderlessComponentImplementation(GraphApi, (props: any) => {
  const { context } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const surfaceId = context?.dataContext?.surface?.id || 'unknown';
  const componentId = context?.componentModel?.id || context?.id || 'graph';
  
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }`
);

// Remove the old Resolve data block
graphContent = graphContent.replace(
  /\/\/ Resolve data\s*let data: any\[\] = \[\];\s*if \(props\.data && typeof props\.data === 'object' && 'path' in props\.data\) \{[\s\S]*?\} else \{\s*data = Array\.isArray\(props\.data\) \? props\.data : \[\];\s*\}/,
  `// Resolve data (already resolved by A2UI v0.9 envelope)
    let data: any[] = [];
    let resolvedData = props.data;
    if (resolvedData instanceof Map) {
      data = Array.from(resolvedData.values()).map(inner => unpackA2uiData(inner));
    } else if (Array.isArray(resolvedData)) {
      data = resolvedData.map(inner => unpackA2uiData(inner));
    } else {
      data = unpackA2uiData(resolvedData) || [];
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        data = [data];
      }
    }
    console.log('Graph - Unpacked resolved data:', data);`
);

// Fix onClick action to use componentId
graphContent = graphContent.replace(
  /sourceComponentId: node\.id,/g,
  `sourceComponentId: componentId,`
);
graphContent = graphContent.replace(
  /graphId: node\.id,/g,
  `graphId: componentId,`
);
graphContent = graphContent.replace(
  /node,/g,
  `componentId,` // replace dependency array [node, surfaceId, context] -> [componentId, surfaceId, context]
);

fs.writeFileSync('src/components/Graph.tsx', graphContent);

// Fix KnowledgeGraph.tsx
let kgContent = fs.readFileSync('src/components/KnowledgeGraph.tsx', 'utf8');

kgContent = kgContent.replace(
  /export const KnowledgeGraph = createBinderlessComponentImplementation\(KnowledgeGraphApi, \(\{ context \}\) => \{[\s\S]*?const title = properties\.title \|\| '';\s*const layoutName = properties\.layout \|\| 'grid';/,
  `export const KnowledgeGraph = createBinderlessComponentImplementation(KnowledgeGraphApi, (props: any) => {
  const { context } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const surfaceId = context?.dataContext?.surface?.id || 'unknown';
  const componentId = context?.componentModel?.id || context?.id || 'knowledge-graph';
  
  const title = props.title || '';
  const layoutName = props.layout || 'grid';`
);

kgContent = kgContent.replace(
  /\/\/ Resolve data\s*let resolvedData = properties\.data;\s*if \(resolvedData && typeof resolvedData === 'object' && 'path' in resolvedData\) \{[\s\S]*?\} else \{\s*resolvedData = unpackA2uiData\(resolvedData\);\s*\}/,
  `// Resolve data (already resolved by A2UI v0.9 envelope)
    let resolvedData = unpackA2uiData(props.data);`
);

kgContent = kgContent.replace(
  /sourceComponentId: node\.id,/g,
  `sourceComponentId: componentId,`
);
kgContent = kgContent.replace(
  /graphId: node\.id,/g,
  `graphId: componentId,`
);
kgContent = kgContent.replace(
  /node,/g,
  `componentId,`
);

fs.writeFileSync('src/components/KnowledgeGraph.tsx', kgContent);
