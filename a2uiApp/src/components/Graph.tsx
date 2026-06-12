import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import type { ChartType, ChartConfiguration } from 'chart.js';
import { createBinderlessComponentImplementation } from '@a2ui/react/v0_9';
import { z } from 'zod';

Chart.register(...registerables);

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

export const GraphApi = {
  name: 'Graph',
  schema: z.object({
    data: z.any().optional(),
    graphType: z.string().optional(),
    interactive: z.boolean().optional(),
    title: z.string().optional(),
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
    emits: z.array(z.string()).optional()
  }) as any
};

export default createBinderlessComponentImplementation(GraphApi, (props: any) => {
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
    }

    // Resolve data (already resolved by A2UI v0.9 envelope)
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
    console.log('Graph - Unpacked resolved data:', data);

    const graphType = (props.graphType || 'line') as ChartType;
    const interactive = props.interactive !== false;
    const title = props.title || '';
    const xLabel = props.xLabel || '';
    const yLabel = props.yLabel || '';

    let labels: any[] = [];
    let values: any[] = [];

    if (data.length > 0) {
      if (typeof data[0] === 'object' && data[0] !== null) {
        if ('x' in data[0] && 'y' in data[0]) {
          labels = data.map(d => d.x);
          values = data.map(d => d.y);
        } else if ('label' in data[0] && 'value' in data[0]) {
          labels = data.map(d => d.label);
          values = data.map(d => d.value);
        } else {
          // Fallback to first string and first numeric keys
          const keys = Object.keys(data[0]);
          const numKey = keys.find(k => typeof data[0][k] === 'number') || keys[1];
          const strKey = keys.find(k => typeof data[0][k] === 'string') || keys[0];
          labels = data.map(d => d[strKey]);
          values = data.map(d => d[numKey]);
        }
      } else {
        labels = data.map((_, i) => i + 1);
        values = data;
      }
    }

    console.log('Graph rendering config:', { labels, values, graphType, title });

    const config: ChartConfiguration = {
      type: graphType,
      data: {
        labels: labels,
        datasets: [{
          label: title || 'Data',
          data: values,
          backgroundColor: [
            'rgba(102, 126, 234, 0.5)',
            'rgba(118, 75, 162, 0.5)',
            'rgba(237, 100, 166, 0.5)',
            'rgba(255, 154, 0, 0.5)',
            'rgba(52, 211, 153, 0.5)',
          ],
          borderColor: [
            'rgba(102, 126, 234, 1)',
            'rgba(118, 75, 162, 1)',
            'rgba(237, 100, 166, 1)',
            'rgba(255, 154, 0, 1)',
            'rgba(52, 211, 153, 1)',
          ],
          borderWidth: 2,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: interactive ? 'index' : undefined,
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
          title: {
            display: !!title,
            text: title || '',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          tooltip: {
            enabled: interactive
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: !!xLabel,
              text: xLabel || ''
            }
          },
          y: {
            display: true,
            title: {
              display: !!yLabel,
              text: yLabel || ''
            },
            beginAtZero: true
          }
        },
        onClick: (_event, elements) => {
          if (!props.emits?.includes('graph.point.selected')) return;
          if (!elements.length) return;

          const element = elements[0];
          const index = element.index;
          const label = labels[index];
          const value = values[index];

          const userAction = {
            event: {
              name: 'graph.point.selected',
              sourceComponentId: componentId,
              surfaceId: surfaceId,
              timestamp: new Date().toISOString(),
              context: {
                label,
                value,
                index,
                graphId: componentId,
                title
              }
            }
          };

          console.log('Graph click dispatched action:', userAction);
          if (context && typeof context.dispatchAction === 'function') {
            context.dispatchAction(userAction);
          }
        }
      }
    };

    chartRef.current = new Chart(ctx, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [componentId, surfaceId, context]);

  return (
    <div className="graph-container" style={{ width: '100%', height: '400px', padding: '1rem', background: '#white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
});
