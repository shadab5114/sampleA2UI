import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { createBinderlessComponentImplementation } from '@a2ui/react/v0_9';
import { z } from 'zod';

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
    if (data.valueArray) return unpackA2uiData(data.valueArray);
    if (data.valueMap) return unpackA2uiData(data.valueMap);
    
    // Check if it is a list of key-value pairs (valueMap in list context)
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

function processGraphData(data: any): any[] {
  const elements: any[] = [];
  let items: any[] = [];

  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === 'object') {
    if (data.nodes) items.push(...(Array.isArray(data.nodes) ? data.nodes : []));
    if (data.edges) items.push(...(Array.isArray(data.edges) ? data.edges : []));
    if (items.length === 0) {
      const keys = Object.keys(data);
      if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
        items = Object.values(data);
      }
    }
  }

  items.forEach((item, index) => {
    if (!item) return;
    if (item.source && item.target) {
      elements.push({
        data: {
          id: item.id || `e-${item.source}-${item.target}`,
          source: item.source,
          target: item.target,
          label: item.label || ''
        }
      });
    } else {
      elements.push({
        data: {
          id: item.id || item.name || `n${index}`,
          label: item.label || item.name || item.id || 'Node',
          properties: item
        }
      });
    }
  });

  return elements;
}

export const KnowledgeGraphApi = {
  name: 'KnowledgeGraph',
  schema: z.object({
    data: z.any().optional(),
    title: z.string().optional(),
    layout: z.string().optional(),
    emits: z.array(z.string()).optional()
  }) as any
};

export const KnowledgeGraph = createBinderlessComponentImplementation(KnowledgeGraphApi, (props: any) => {
  const { context } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const surfaceId = context?.dataContext?.surface?.id || 'unknown';
  const componentId = context?.componentModel?.id || context?.id || 'knowledge-graph';
  
  const title = props.title || '';
  const layoutName = props.layout || 'grid';

  useEffect(() => {
    if (!containerRef.current) return;

    // Resolve data (already resolved by A2UI v0.9 envelope)
    let resolvedData = unpackA2uiData(props.data);

    const elements = processGraphData(resolvedData);

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#666',
            'label': 'data(label)',
            'color': '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '10px',
            'width': '80px',
            'height': '80px',
            'text-wrap': 'wrap',
            'text-max-width': '70px',
            'line-height': 1.2
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '9px',
            'text-rotation': 'autorotate',
            'text-margin-y': -10
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': '3px',
            'border-color': '#007bff',
            'background-color': '#555'
          }
        }
      ],
      layout: { name: layoutName } as any
    });

    cyRef.current = cy;

    const emitSemanticEvent = (eventType: string, eventData: any) => {
      if (!props.emits || !props.emits.includes(eventType)) {
        return;
      }

      const userAction = {
        event: {
          name: eventType,
          sourceComponentId: componentId,
          surfaceId: surfaceId,
          timestamp: new Date().toISOString(),
          context: eventData
        }
      };

      if (context && typeof context.dispatchAction === 'function') {
        context.dispatchAction(userAction);
      }
    };

    cy.on('tap', 'node', (evt) => {
      const target = evt.target;
      setSelectedNode(target.data());
      emitSemanticEvent('graph.node.selected', {
        nodeId: target.id(),
        nodeData: target.data()
      });
    });

    cy.on('tap', 'edge', (evt) => {
      const target = evt.target;
      emitSemanticEvent('graph.edge.selected', {
        edgeId: target.id(),
        edgeData: target.data()
      });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    setTimeout(() => {
      if (cyRef.current) {
        cyRef.current.layout({ name: layoutName, fit: true, padding: 30 } as any).run();
      }
    }, 100);

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [componentId, surfaceId, context]);

  const getNodeProps = () => {
    if (!selectedNode) return [];
    const props = selectedNode.properties || selectedNode;
    return Object.entries(props)
      .filter(([key]) => key !== 'properties')
      .map(([key, value]) => ({
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value)
      }));
  };

  return (
    <div className="kg-container" style={{
      width: '100%',
      height: '600px',
      display: 'flex',
      flexDirection: 'column',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '1rem',
      boxSizing: 'border-box'
    }}>
      <div className="kg-header" style={{ marginBottom: '1rem' }}>
        {title && <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>{title}</h3>}
      </div>
      <div className="kg-content" style={{
        flex: 1,
        display: 'flex',
        minHeight: 0,
        position: 'relative'
      }}>
        <div ref={containerRef} className="graph-surface" style={{
          flex: 1,
          height: '100%',
          background: '#f8f9fa',
          borderRadius: '4px',
          border: '1px solid #eee'
        }}></div>
        
        {selectedNode && (
          <div className="details-panel" style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            bottom: '10px',
            width: '280px',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #ddd',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
            zIndex: 100,
            backdropFilter: 'blur(4px)'
          }}>
            <div className="details-header" style={{
              padding: '0.75rem',
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#fcfcfc'
            }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>Node Details</h4>
              <button 
                className="close-btn" 
                onClick={() => setSelectedNode(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  color: '#999',
                  lineHeight: 1
                }}
              >×</button>
            </div>
            <div className="details-body" style={{
              padding: '0.75rem',
              overflowY: 'auto',
              fontSize: '0.85rem'
            }}>
              {getNodeProps().map((prop) => (
                <div key={prop.key} className="prop-row" style={{
                  marginBottom: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <span className="prop-key" style={{
                    fontWeight: 600,
                    color: '#666',
                    marginBottom: '0.1rem'
                  }}>{prop.key}:</span>
                  <span className="prop-value" style={{
                    color: '#333',
                    wordBreak: 'break-all'
                  }}>{prop.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
