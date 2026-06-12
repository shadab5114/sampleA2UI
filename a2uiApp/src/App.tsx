import React, { useState, useEffect } from 'react';
import { A2uiSurface, basicCatalog } from '@a2ui/react/v0_9';
import { MessageProcessor, Catalog } from '@a2ui/web_core/v0_9';
import { a2aService } from './services/a2aService';
import Graph from './components/Graph';
import { KnowledgeGraph } from './components/KnowledgeGraph';


const appCatalog = new Catalog(
  'basic',
  [...Array.from(basicCatalog.components.values()), Graph, KnowledgeGraph],
  basicCatalog.functions ? Array.from(basicCatalog.functions.values()) : []
);

// A helper component to access the A2UI context and expose it



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


// Helper to split v0.8 mega-messages (which contained createSurface AND updateComponents together) into valid v0.9 individual messages
const splitMegaMessages = (messages: any[]): any[] => {
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
};


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

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textResponse, setTextResponse] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  
  const [surfaces, setSurfaces] = useState<any[]>([]);
  
  const [processor] = useState(() => {
    const proc = new MessageProcessor([appCatalog], (msg) => {
      if (handleActionRef.current) {
        return handleActionRef.current(msg);
      }
    });
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
  
  const handleActionRef = React.useRef<any>(null);

  useEffect(() => {
    handleActionRef.current = handleAction;
  });
  
  const [serverUrl, setServerUrl] = useState('http://localhost:7860');
  const [uiMode, setUiMode] = useState(true);
  
  // Advanced credentials settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sendCredentials, setSendCredentials] = useState(false);

  // Server connect options
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [tempUrl, setTempUrl] = useState('http://localhost:7860');
  const availableServers = [
    'http://localhost:7860',
    'http://localhost:8080',
    'https://vishalmysore-fraudagent.hf.space',
    'https://vishalmysore-processor.hf.space',
    'https://vishalmysore-a2amcpdatabase.hf.space/',
    'https://vishalmysore-graphagent.hf.space/'
  ];

  // Agent Card
  const [showAgentCard, setShowAgentCard] = useState(false);
  const [agentCard, setAgentCard] = useState<any>(null);

  // Test A2UI Panel
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testJson, setTestJson] = useState('');
  const [testError, setTestError] = useState<string | null>(null);
  const [selectedExample, setSelectedExample] = useState('');
  const exampleFiles = [
    'AnalyticsDashboard.json',
    'EcommerceProduct.json',
    'FlightExample.json',
    'food.json',
    'GraphDashboard-Backend.json',
    'MarketingDashboard-Backend.json',
    'ProjectDashboard.json',
    'sakesadvanced.json',
    'salesex.json',
    'SimpleGraph-Backend.json',
    'test-simple.json',
    'test-with-list.json',
    'knowledge-graph-test.json',
    'knowledge-graph-structured.json',
    'delivery-routes.json',
    'customer-journey.json',
    'ux-flow-onboarding.json',
    'infrastructure-failure.json',
    'fraud-detection-network.json',
    'fraud-detection-network-interactive.json',
    'medical-diagnosis.json',
    'portfolio-risk-analysis.json',
    'org-chart-interactive.json',
    'supply-chain-disruption.json',
    'influencer-network.json'
  ];

  // Test OpenJSONUI Panel
  const [showOpenJsonPanel, setShowOpenJsonPanel] = useState(false);
  const [openJsonText, setOpenJsonText] = useState('');
  const [openJsonError, setOpenJsonError] = useState<string | null>(null);
  const [selectedOpenJsonExample, setSelectedOpenJsonExample] = useState('');
  const openJsonExamples = [
    'open-json-food.json',
    'open-json-welcome.json'
  ];

  // Debug Panel
  const [showDebug, setShowDebug] = useState(false);
  const [lastRequest, setLastRequest] = useState<any>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);

  // About Widget
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    a2aService.setServerUrl(serverUrl);
    loadAgentCard();
  }, [serverUrl]);
  
  useEffect(() => {
    a2aService.setUiMode(uiMode);
  }, [uiMode]);

  useEffect(() => {
    a2aService.setUsername(username);
  }, [username]);

  useEffect(() => {
    a2aService.setPassword(password);
  }, [password]);

  useEffect(() => {
    a2aService.setSendCredentials(sendCredentials);
  }, [sendCredentials]);

  const loadAgentCard = async () => {
    try {
      setAgentCard(null);
      const card = await a2aService.getAgentCard();
      setAgentCard(card);
      console.log('Agent Card loaded:', card);
    } catch (err) {
      console.warn('Failed to load agent card:', err);
    }
  };

  const handleAction = async (msg: any) => {
    console.log('Action received:', msg);
    const eventData = msg.message || msg;
    try {
      setLoading(true);
      const parts = [
        {
          kind: 'data',
          metadata: { mimeType: 'application/a2ui+json' },
          data: eventData
        }
      ];
      
      setLastRequest({
        timestamp: new Date().toISOString(),
        parts: parts
      });

      const response = await a2aService.sendMessage(parts as any);
      
      setLastResponse({
        timestamp: new Date().toISOString(),
        data: response
      });

      processResponse(response);
      
      if (msg.completion && typeof msg.completion.complete === 'function') {
         msg.completion.complete();
      }
    } catch (e: any) {
      setError(e.message);
      if (msg.completion && typeof msg.completion.error === 'function') {
        msg.completion.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  const processResponse = (response: any) => {
    console.log('Processing response:', response);
    let parts: any[] = [];
    
    // Support standard response parsing paths
    if (response.result?.status?.message?.parts) {
      parts = response.result.status.message.parts;
    } else if (response.status?.message?.parts) {
      parts = response.status.message.parts;
    } else if (response.message?.parts) {
      parts = response.message.parts;
    } else if (response.parts) {
      parts = response.parts;
    }

    if (parts.length > 0) {
      if (uiMode) {
        let newMessages: any[] = [];
        parts.forEach((part: any) => {
          if (part.data && (part.metadata?.mimeType === 'application/a2ui+json' || part.data.updateComponents || part.data.createSurface || part.data.updateDataModel)) {
            newMessages.push(part.data);
            
            // Track active surface IDs
            if (part.data.updateComponents?.surfaceId) {
              
            }
          }
        });
        if (newMessages.length > 0) {
          newMessages = splitMegaMessages(newMessages);
          newMessages.forEach(msg => {
            if (msg.createSurface && !msg.createSurface.catalogId) {
              msg.createSurface.catalogId = 'basic';
            }
          });
          newMessages.sort((a, b) => {
            if (a.createSurface && !b.createSurface) return -1;
            if (!a.createSurface && b.createSurface) return 1;
            return 0;
          });
          processor.processMessages(newMessages);
        }
      } else {
        const texts: string[] = [];
        parts.forEach((part: any) => {
          if (part.text) {
            try {
              const parsed = JSON.parse(part.text);
              if (parsed.updateComponents) {
                console.log('Skipping A2UI data in text mode');
                return;
              }
              texts.push(JSON.stringify(parsed, null, 2));
            } catch {
              texts.push(part.text);
            }
          }
        });
        if (texts.length > 0) {
          setTextResponse(texts.join('\n\n'));
        }
      }
    } else {
      console.warn('No standard parts found in response. Showing raw response.');
      setTextResponse('Received response but could not find message parts:\n' + JSON.stringify(response, null, 2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    
    setLoading(true);
    setError(null);
    setTextResponse(null);
    // setPendingMessages([]);
    
    try {
      const parts = [{ kind: 'text', text: inputMessage }];
      
      setLastRequest({
        timestamp: new Date().toISOString(),
        parts: parts
      });

      const response = await a2aService.sendMessage(parts as any);
      
      setLastResponse({
        timestamp: new Date().toISOString(),
        data: response
      });

      processResponse(response);
      setInputMessage('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    // Clear logic
    surfaces.forEach(s => processor.processMessages([{ version: 'v0.9', deleteSurface: { surfaceId: s.id } }]));
    setTextResponse(null);
    setError(null);
    setLastRequest(null);
    setLastResponse(null);
  };

  // Connect Server helpers
  const toggleConnectForm = () => {
    const wasOpen = showConnectForm;
    setShowConnectForm(!wasOpen);
    if (!wasOpen) {
      setTempUrl(serverUrl);
    }
  };

  const connectToServer = async () => {
    const url = tempUrl.trim();
    if (!url) return;

    setServerUrl(url);
    setShowConnectForm(false);
    setLastRequest(null);
    setLastResponse(null);
  };

  // Test examples loading helper
  const handleExampleSelect = async (filename: string) => {
    setSelectedExample(filename);
    if (!filename) return;
    setTestError(null);
    try {
      const response = await fetch(`examples/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load example: ${response.statusText}`);
      }
      const content = await response.text();
      setTestJson(content);
    } catch (err: any) {
      setTestError(`Failed to load example: ${err.message}`);
    }
  };

  const handleOpenJsonExampleSelect = async (filename: string) => {
    setSelectedOpenJsonExample(filename);
    if (!filename) {
      setOpenJsonText('');
      return;
    }
    setOpenJsonError(null);
    try {
      const response = await fetch(`examples/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load example: ${response.statusText}`);
      }
      const content = await response.text();
      setOpenJsonText(content);
    } catch (err: any) {
      setOpenJsonError(`Failed to load example: ${err.message}`);
    }
  };

  // Render pasted test JSON using local context actions
  const renderTestJson = () => {
    setTestError(null);
    const jsonStr = testJson.trim();
    if (!jsonStr) {
      setTestError('Please enter A2UI JSON to test');
      return;
    }

    // Clear test surfaces
    surfaces.forEach(surface => { const surfaceId = surface.id;
      try {
        processor.processMessages([{ version: 'v0.9', deleteSurface: { surfaceId } }]);
      } catch (err) {
        console.warn('Failed to delete surface:', surfaceId, err);
      }
    });
    

    try {
      const parsed = JSON.parse(jsonStr);
      let processorMessages: any[] = [];

      if (Array.isArray(parsed)) {
        processorMessages = parsed.filter(m => m.updateComponents || m.updateDataModel || m.createSurface);
      } else if (parsed.updateComponents || parsed.updateDataModel || parsed.createSurface) {
        processorMessages = [parsed];
      } else if (parsed.result?.status?.message?.parts) {
        const parts = parsed.result.status.message.parts;
        parts.forEach((p: any) => {
          if (p.data && (p.data.updateComponents || p.data.updateDataModel || p.data.createSurface)) {
            processorMessages.push(p.data);
          }
        });
      }

      if (processorMessages.length === 0) {
        setTestError('No A2UI data found. Expected updateComponents, updateDataModel, or createSurface in JSON.');
        return;
      }

      // Validate component structures
      processorMessages = splitMegaMessages(processorMessages);
      processorMessages.forEach(msg => {
        if (msg.createSurface && !msg.createSurface.catalogId) {
          msg.createSurface.catalogId = 'basic';
        }
        
        

        if (msg.updateComponents?.components) {
          msg.updateComponents.components = msg.updateComponents.components
            .filter((c: any) => c && c.id && c.component)
            .map(convertV8toV9);
        }
      });

      console.log('Rendering local test A2UI JSON messages:', processorMessages);
      processorMessages.sort((a, b) => {
        if (a.createSurface && !b.createSurface) return -1;
        if (!a.createSurface && b.createSurface) return 1;
        return 0;
      });
      processor.processMessages(processorMessages);

      processorMessages.forEach(msg => {
        
        

        if (msg.updateComponents?.components) {
              msg.updateComponents.components = msg.updateComponents.components
                .filter((c: any) => c && c.id && c.component)
                .map(convertV8toV9);
            }
            if (msg.updateComponents?.surfaceId) {
          
        }
      });
    } catch (err: any) {
      setTestError(`JSON Parse Error: ${err.message}`);
    }
  };

  const clearTest = () => {
    surfaces.forEach(surface => { const surfaceId = surface.id;
      try {
        processor.processMessages([{ version: 'v0.9', deleteSurface: { surfaceId } }]);
      } catch (err) {
        console.warn('Failed to delete surface:', surfaceId, err);
      }
    });
    
    setTestJson('');
    setTestError(null);
    setSelectedExample('');
  };

  // Convert and render OpenJSONUI format
  const mapOpenJsonToA2UI = (openJson: any): any[] => {
    const surfaceId = `openjson-${Date.now()}`;
    const allComponents: any[] = [];

    const processItem = (item: any, parentId: string, index: number): string => {
      const id = `${parentId}-${item.type}-${index}`;
      let processorComponent: any = null;

      if (item.type === 'card') {
        const cardContentId = `${id}-content`;
        const children: string[] = [];

        if (item.title) {
          const titleId = `${id}-title`;
          allComponents.push({
            id: titleId,
            component: {
              Text: {
                usageHint: 'h3',
                text: { literalString: item.title }
              }
            }
          });
          children.push(titleId);
        }

        if (item.content) {
          item.content.forEach((childItem: any, childIndex: number) => {
            const childId = processItem(childItem, id, childIndex);
            children.push(childId);
          });
        }

        allComponents.push({
          id: cardContentId,
          component: {
            Column: {
              children: { explicitList: children },
              alignment: 'stretch'
            }
          }
        });

        processorComponent = {
          Card: { child: cardContentId }
        };
      } else if (item.type === 'text') {
        processorComponent = {
          Text: {
            text: { literalString: item.content }
          }
        };
      } else if (item.type === 'divider') {
        processorComponent = {
          Divider: {}
        };
      } else if (item.type === 'form') {
        const children: string[] = [];

        if (item.fields) {
          item.fields.forEach((f: any, fIndex: number) => {
            const fieldId = `${id}-field-${fIndex}`;
            allComponents.push({
              id: fieldId,
              component: {
                TextField: {
                  label: { literalString: f.label },
                  placeholder: { literalString: f.placeholder },
                  required: f.required
                }
              }
            });
            children.push(fieldId);
          });
        }

        if (item.submit) {
          const submitId = `${id}-submit`;
          const submitTextId = `${submitId}-text`;
          allComponents.push({
            id: submitTextId,
            component: {
              Text: { text: { literalString: item.submit.label } }
            }
          });
          allComponents.push({
            id: submitId,
            component: {
              Button: {
                action: { name: item.submit.action },
                child: submitTextId,
                primary: true
              }
            }
          });
          children.push(submitId);
        }

        processorComponent = {
          Column: {
            children: { explicitList: children },
            alignment: 'stretch'
          }
        };
      }

      allComponents.push({
        id: id,
        component: processorComponent
      });
      return id;
    };

    const rootChildren: string[] = [];
    if (openJson.title) {
      const titleId = `root-title`;
      allComponents.push({
        id: titleId,
        component: {
          Text: {
            usageHint: 'h1',
            text: { literalString: openJson.title }
          }
        }
      });
      rootChildren.push(titleId);
    }

    if (openJson.content) {
      openJson.content.forEach((item: any, index: number) => {
        const id = processItem(item, 'root', index);
        rootChildren.push(id);
      });
    }

    const rootId = 'root-container';
    allComponents.push({
      id: rootId,
      component: {
        Column: {
          children: { explicitList: rootChildren },
          alignment: 'stretch'
        }
      }
    });

    return [
      {
        updateComponents: {
          surfaceId: surfaceId,
          components: allComponents
        }
      },
      {
        createSurface: {
          surfaceId: surfaceId,
          root: rootId
        }
      }
    ];
  };

  const renderOpenJson = () => {
    setOpenJsonError(null);
    const jsonStr = openJsonText.trim();
    if (!jsonStr) {
      setOpenJsonError('Please enter OpenJSONUI JSON to test');
      return;
    }

    // Clear test surfaces
    surfaces.forEach(surface => { const surfaceId = surface.id;
      try {
        processor.processMessages([{ version: 'v0.9', deleteSurface: { surfaceId } }]);
      } catch (err) {
        console.warn('Failed to delete surface:', surfaceId, err);
      }
    });
    

    try {
      const parsed = JSON.parse(jsonStr);
      let processorMessages: any[] = [];

      if (parsed.type === 'screen') {
        processorMessages = mapOpenJsonToA2UI(parsed);
      } else {
        setOpenJsonError('Invalid OpenJSONUI format. Root component must be type: "screen"');
        return;
      }

      processorMessages.forEach(msg => {
        processor.processMessages([msg]);
        
        

        if (msg.updateComponents?.components) {
              msg.updateComponents.components = msg.updateComponents.components
                .filter((c: any) => c && c.id && c.component)
                .map(convertV8toV9);
            }
            if (msg.updateComponents?.surfaceId) {
          
        }
      });
    } catch (err: any) {
      setOpenJsonError(`JSON Parse Error: ${err.message}`);
    }
  };

  const clearOpenJson = () => {
    surfaces.forEach(surface => { const surfaceId = surface.id;
      try {
        processor.processMessages([{ version: 'v0.9', deleteSurface: { surfaceId } }]);
      } catch (err) {
        console.warn('Failed to delete surface:', surfaceId, err);
      }
    });
    
    setOpenJsonText('');
    setOpenJsonError(null);
    setSelectedOpenJsonExample('');
  };

  // Debug pane clipboard helpers
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const getCurlCommand = () => {
    let curl = `curl -X POST "${serverUrl}" \\\n`;
    Object.entries(a2aService.lastHeaders).forEach(([key, value]) => {
      curl += `  -H "${key}: ${value}" \\\n`;
    });
    curl += `  -d '${JSON.stringify(lastRequest, null, 2)}'`;
    return curl;
  };

  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  return (
    <MainContent 
        loading={loading}
        error={error}
        textResponse={textResponse}
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        surfaces={surfaces} processor={processor}
        serverUrl={serverUrl}
        setServerUrl={setServerUrl}
        uiMode={uiMode}
        setUiMode={setUiMode}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        sendCredentials={sendCredentials}
        setSendCredentials={setSendCredentials}
        showConnectForm={showConnectForm}
        setShowConnectForm={setShowConnectForm}
        tempUrl={tempUrl}
        setTempUrl={setTempUrl}
        availableServers={availableServers}
        showAgentCard={showAgentCard}
        setShowAgentCard={setShowAgentCard}
        agentCard={agentCard}
        showTestPanel={showTestPanel}
        setShowTestPanel={setShowTestPanel}
        testJson={testJson}
        setTestJson={setTestJson}
        testError={testError}
        selectedExample={selectedExample}
        exampleFiles={exampleFiles}
        handleExampleSelect={handleExampleSelect}
        renderTestJson={renderTestJson}
        clearTest={clearTest}
        showOpenJsonPanel={showOpenJsonPanel}
        setShowOpenJsonPanel={setShowOpenJsonPanel}
        openJsonText={openJsonText}
        setOpenJsonText={setOpenJsonText}
        openJsonError={openJsonError}
        selectedOpenJsonExample={selectedOpenJsonExample}
        openJsonExamples={openJsonExamples}
        handleOpenJsonExampleSelect={handleOpenJsonExampleSelect}
        renderOpenJson={renderOpenJson}
        clearOpenJson={clearOpenJson}
        showAbout={showAbout}
        setShowAbout={setShowAbout}
        showDebug={showDebug}
        setShowDebug={setShowDebug}
        lastRequest={lastRequest}
        lastResponse={lastResponse}
        handleSubmit={handleSubmit}
        clearChat={clearChat}
        copyToClipboard={copyToClipboard}
        getCurlCommand={getCurlCommand}
        formatJson={formatJson}
        toggleConnectForm={toggleConnectForm}
        connectToServer={connectToServer}
      />
  );
}

// Subcomponent that consumes the A2UI context directly
function MainContent({
  loading, error, textResponse, inputMessage, setInputMessage,
  surfaces, processor,
  serverUrl, uiMode, setUiMode,
  showAdvanced, setShowAdvanced, username, setUsername, password, setPassword,
  sendCredentials, setSendCredentials, showConnectForm, tempUrl, setTempUrl,
  availableServers, showAgentCard, setShowAgentCard, agentCard,
  showTestPanel, setShowTestPanel, testJson, setTestJson, testError,
  selectedExample, exampleFiles, handleExampleSelect, renderTestJson, clearTest,
  showOpenJsonPanel, setShowOpenJsonPanel, openJsonText, setOpenJsonText, openJsonError,
  selectedOpenJsonExample, openJsonExamples, handleOpenJsonExampleSelect, renderOpenJson, clearOpenJson,
  showAbout, setShowAbout, showDebug, setShowDebug, lastRequest, lastResponse,
  handleSubmit, clearChat, copyToClipboard, getCurlCommand, formatJson,
  toggleConnectForm, connectToServer
}: any) {
  
  

  return (
    <>
      
      <div className="container">
        <div className="left-panel">
          <h1>SimpleA2UI : A2UI Client (React)</h1>
          
          <form onSubmit={handleSubmit} className="message-form">
            <input 
              type="text" 
              name="body"
              className="inputField"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Enter message" 
            />
            <button type="submit">Send</button>
            <button type="button" className="clear-btn" onClick={clearChat}>Clear Chat</button>
          </form>

          <div className="advanced-settings">
            <button type="button" className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? '▼' : '▶'} Advanced Settings
            </button>
            
            {showAdvanced && (
              <div className="credentials-form">
                <div className={`credential-input ${!sendCredentials ? 'disabled' : ''}`}>
                  <label htmlFor="username">User:</label>
                  <input 
                    id="username"
                    type="text" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    disabled={!sendCredentials}
                    placeholder="Username" 
                  />
                </div>
                <div className={`credential-input ${!sendCredentials ? 'disabled' : ''}`}>
                  <label htmlFor="password">Pass:</label>
                  <input 
                    id="password"
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    disabled={!sendCredentials}
                    placeholder="Password" 
                  />
                </div>
                <div className="credential-input credential-toggle">
                  <label htmlFor="sendCredentials" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                      id="sendCredentials"
                      type="checkbox"
                      checked={sendCredentials}
                      onChange={(e) => setSendCredentials(e.target.checked)} 
                    />
                    Send username/password with requests
                  </label>
                </div>
              </div>
            )}
          </div>

          {loading && <div className="loading">Loading...</div>}
          {error && <div className="error">Error: {error}</div>}

          {uiMode && (
            <div className="surfaces">
              {surfaces.map((surface: any) => (
    <div key={surface.id} style={{ marginBottom: '1.5rem' }}>
      <A2uiSurface surface={surface} />
    </div>
  ))}
            </div>
          )}

          {!uiMode && textResponse && (
            <div className="text-response">
              <h3>Response:</h3>
              <pre>{textResponse}</pre>
            </div>
          )}

          <div className="debug-panel">
            <button className="debug-toggle" onClick={() => setShowDebug(!showDebug)}>
              {showDebug ? '▼' : '▶'} Debug: Raw Request/Response
            </button>
            
            {showDebug && (
              <div className="debug-content">
                {lastRequest && (
                  <div className="debug-section">
                    <div className="debug-header">
                      <h4>Last Request (Body)</h4>
                      <div>
                        <button className="copy-btn" onClick={() => copyToClipboard(formatJson(lastRequest))}>Copy Body</button>
                        <button className="copy-btn curl-btn" onClick={() => copyToClipboard(getCurlCommand())}>Copy as CURL</button>
                      </div>
                    </div>
                    <pre>{formatJson(lastRequest)}</pre>
                  </div>
                )}
                
                {lastRequest && (
                  <div className="debug-section">
                    <div className="debug-header">
                      <h4>Request Headers</h4>
                      <button className="copy-btn" onClick={() => copyToClipboard(formatJson(a2aService.lastHeaders))}>Copy Headers</button>
                    </div>
                    <pre>{formatJson(a2aService.lastHeaders)}</pre>
                  </div>
                )}
                
                {lastResponse && (
                  <div className="debug-section">
                    <div className="debug-header">
                      <h4>Last Response</h4>
                      <button className="copy-btn" onClick={() => copyToClipboard(formatJson(lastResponse))}>Copy</button>
                    </div>
                    <pre>{formatJson(lastResponse)}</pre>
                  </div>
                )}
                
                {!lastRequest && !lastResponse && (
                  <p className="debug-empty">No request/response data yet. Send a message to see debug info.</p>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="right-panel">
          <div className="mode-toggle">
            <div className="mode-label">Response Mode:</div>
            <div className="toggle-buttons">
              <button 
                className={`mode-btn ${uiMode ? 'active' : ''}`}
                onClick={() => { setUiMode(true); }}
              >
                UI
              </button>
              <button 
                className={`mode-btn ${!uiMode ? 'active' : ''}`}
                onClick={() => { setUiMode(false); }}
              >
                Text
              </button>
            </div>
          </div>
          
          <div className="server-status">
            <div className="status-info">
              <strong>Server:</strong> {serverUrl}
            </div>
            <button className="connect-btn" onClick={toggleConnectForm}>
              {showConnectForm ? 'Cancel' : 'Change Server'}
            </button>
          </div>
          
          {showConnectForm && (
            <div className="connect-form">
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <label htmlFor="serverSelect" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Available Servers:</label>
                <select 
                  id="serverSelect"
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  onChange={(e) => setTempUrl(e.target.value)}
                  value={tempUrl}
                >
                  <option value="">-- Select a server --</option>
                  {availableServers.map((server: string) => (
                    <option key={server} value={server}>{server}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <label htmlFor="serverUrlInput" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Server URL:</label>
                <input 
                  id="serverUrlInput"
                  type="text" 
                  style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                  value={tempUrl} 
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="https://your-server-url.com" 
                />
              </div>
              <button className="connect-btn" onClick={connectToServer}>Connect</button>
            </div>
          )}

          <button className="toggle-btn" onClick={() => setShowAgentCard(!showAgentCard)}>
            {showAgentCard ? 'Hide' : 'Show'} Agent Card
          </button>
          
          <button className="test-btn" onClick={() => setShowTestPanel(!showTestPanel)}>
            {showTestPanel ? 'Hide' : 'Test A2UI Renderer'}
          </button>
          
          {showTestPanel && (
            <div className="test-panel">
              <h3>Test A2UI JSON</h3>
              <p className="test-description">Paste your A2UI JSON below to see how it renders. Supports both direct A2UI JSON and full JSON-RPC responses.</p>
              <div className="example-selector">
                <label htmlFor="exampleSelect">Load Example:</label>
                <select 
                  id="exampleSelect"
                  value={selectedExample}
                  onChange={(e) => handleExampleSelect(e.target.value)}
                >
                  <option value="">-- Select an example --</option>
                  {exampleFiles.map((file: string) => (
                    <option key={file} value={file}>{file}</option>
                  ))}
                </select>
              </div>
              <textarea 
                className="test-textarea"
                value={testJson}
                onChange={(e) => setTestJson(e.target.value)}
                placeholder='Paste A2UI JSON or full response here...'
              />
              <div className="test-actions">
                <button className="render-btn" onClick={() => renderTestJson(processor)}>Render Test</button>
                <button className="clear-test-btn" onClick={() => clearTest(processor)}>Clear Test</button>
              </div>
              {testError && <div className="test-error">{testError}</div>}
            </div>
          )}

          <button className="test-btn open-json-btn" onClick={() => setShowOpenJsonPanel(!showOpenJsonPanel)}>
            {showOpenJsonPanel ? 'Hide' : 'Test OpenJSONUI Renderer'}
          </button>

          {showOpenJsonPanel && (
            <div className="test-panel open-json-panel">
              <h3>Test OpenJSONUI JSON</h3>
              <p className="test-description">Paste your OpenJSONUI JSON below to see how it renders.</p>
              <div className="example-selector">
                <label htmlFor="openJsonExampleSelect">Load Example:</label>
                <select 
                  id="openJsonExampleSelect"
                  value={selectedOpenJsonExample}
                  onChange={(e) => handleOpenJsonExampleSelect(e.target.value)}
                >
                  <option value="">-- Select an example --</option>
                  {openJsonExamples.map((file: string) => (
                    <option key={file} value={file}>{file}</option>
                  ))}
                </select>
              </div>
              <textarea 
                className="test-textarea"
                value={openJsonText}
                onChange={(e) => setOpenJsonText(e.target.value)}
                placeholder="Paste OpenJSONUI JSON here..."
              />
              <div className="test-actions">
                <button className="render-btn" onClick={() => renderOpenJson(processor)}>Render OpenJSONUI</button>
                <button className="clear-test-btn" onClick={() => clearOpenJson(processor)}>Clear</button>
              </div>
              {openJsonError && <div className="test-error">{openJsonError}</div>}
            </div>
          )}

          <button className="about-btn" onClick={() => setShowAbout(!showAbout)}>
            {showAbout ? 'Hide' : 'About'}
          </button>
          
          {showAbout && (
            <div className="about-section">
              <h3>About SimpleA2UI</h3>
              <p>SimpleA2UI is a simple processor client which works with a2a and processor protocol, developed by Vishal Mysore</p> 
              <p style={{ marginTop: '0.5rem' }}>
                This application is a frontend renderer for the A2UI protocol; it doesn't "think" on its own. It requires a connected backend agentic server to process your prompts and send back the structured UI components.
              </p> 
              <p style={{ marginTop: '0.5rem' }}>
                <strong>Check Available Actions:</strong> Click the "Show Agent Card" button in the sidebar. This lists the specific skills and example prompts that the currently connected backend is configured to handle.
              </p>
              <p style={{ marginTop: '0.5rem' }}>
                <strong>Backend Requirement:</strong> If you want to visualize arbitrary data (like 'categories of food'), you must connect the client to a backend agent that has been implemented with that specific capability.
              </p>  
              <p style={{ marginTop: '0.5rem' }}>
                <strong>Test Locally:</strong> If you are a developer, you can use the "Test A2UI Renderer" or "Test OpenJSONUI Renderer" panels to paste your own JSON and see how the UI renders instantly without a backend.
              </p> 
            </div>
          )}

          {showAgentCard && agentCard && (
            <div className="agent-card">
              <div className="agent-header">
                <h2>{agentCard.name}</h2>
                <span className="version">v{agentCard.version}</span>
              </div>
              
              <p className="description">{agentCard.description}</p>
              
              <div className="info-section">
                <div className="info-item">
                  <strong>Provider:</strong> {agentCard.provider?.organization}
                </div>
                <div className="info-item">
                  <strong>Protocol:</strong> {agentCard.protocolVersion}
                </div>
                <div className="info-item">
                  <strong>Streaming:</strong> {agentCard.capabilities?.streaming ? 'Yes' : 'No'}
                </div>
                <div className="info-item">
                  <strong>Push Notifications:</strong> {agentCard.capabilities?.pushNotifications ? 'Yes' : 'No'}
                </div>
              </div>
              
              <div className="skills-section">
                <h3>Available Skills</h3>
                <div className="skills-grid">
                  {agentCard.skills?.map((skill: any) => (
                    <div key={skill.id} className="skill-card">
                      <h4>{skill.name}</h4>
                      <p className="skill-description">{skill.description}</p>
                      
                      <div className="skill-tags">
                        {skill.tags?.map((tag: string) => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                      
                      {skill.examples && skill.examples.length > 0 && (
                        <div className="skill-examples">
                          <strong>Examples:</strong>
                          <ul>
                            {skill.examples.map((example: string) => (
                              <li key={example}>{example}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="footer">
        <p>SimpleA2UI is an open source client implementation of the A2UI protocol developed by Vishal Mysore</p>
      </div>
    </>
  );
}
