import express from 'express';
import cors from 'cors';
import { handleSimpleService } from './services/simpleService.js';
import { handleCompareCarService } from './services/compareCarService.js';
import { handleFraudDetectionService } from './services/fraudDetectionService.js';
import { handleUserProfileService } from './services/userProfileService.js';
import { handleSalesDashboardService } from './services/salesDashboardService.js';
import { handleProductCatalogService, handleProductDetailsService } from './services/productCatalogService.js';
import { handleOrderTrackingService } from './services/orderTrackingService.js';
import { handleLoanCalculatorService } from './services/loanCalculatorService.js';

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors());
app.use(express.json());

// Main A2A JSON-RPC 2.0 endpoint
app.post('/', (req, res) => {
  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== '2.0') {
    return res.status(400).json({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id });
  }

  if (method === 'tasks/send') {
    const parts = params?.message?.parts || [];
    let isUiMode = req.headers['x-a2a-extensions'] ? true : false;
    let responseParts = [];

    // Process each part of the message
    for (const part of parts) {
      // Handle Text input
      if ((part.kind === 'text' || part.type === 'text') && part.text) {
        const text = part.text.toLowerCase();
        
        if (text.includes('favorite food') || text.includes('fav food')) {
          const nameMatch = text.match(/(vishal|vinod)/i);
          const name = nameMatch ? nameMatch[0] : 'anyone';
          responseParts.push(handleSimpleService(name, isUiMode));
        } else if (text.includes('compare')) {
          responseParts.push(handleCompareCarService('honda', 'toyota', isUiMode));
        } else if (text.includes('fraud') || text.includes('transaction')) {
          const nameMatch = text.match(/(bob|vishal)/i);
          const username = nameMatch ? nameMatch[0] : 'bob';
          responseParts.push(handleFraudDetectionService(username, isUiMode, text.includes('suspected') || text.includes('alert')));
        } else if (text.includes('profile') || text.includes('user')) {
          const nameMatch = text.match(/(bob|vishal|john)/i);
          const userId = nameMatch ? nameMatch[0] : 'john';
          responseParts.push(handleUserProfileService(userId, 'Overview', isUiMode));
        } else if (text.includes('sales') || text.includes('dashboard')) {
          responseParts.push(handleSalesDashboardService('monthly', isUiMode));
        } else if (text.includes('product') || text.includes('catalog')) {
          responseParts.push(handleProductCatalogService('Electronics', isUiMode));
        } else if (text.includes('order') || text.includes('track')) {
          responseParts.push(handleOrderTrackingService('ORD-12345', isUiMode));
        } else if (text.includes('loan') || text.includes('calculator')) {
          responseParts.push(handleLoanCalculatorService(150000, 4.5, 30, isUiMode));
        } else {
          // Default fallback listing all available services
          responseParts.push({ text: `Echo: You said "${part.text}". Try asking about user profile, sales dashboard, product catalog, order tracking, loan calculator, favorite food, comparing cars, or fraud detection.` });
        }
      }
      
      // Handle A2UI Action (e.g., Button Clicks from frontend)
      if ((part.kind === 'data' || part.type === 'data') && part.metadata?.mimeType === 'application/a2ui+json' && part.data) {
        const eventData = part.data;
        const actionObj = eventData.userAction || eventData.action;
        console.log('Action received:', JSON.stringify(eventData, null, 2));
        if (actionObj) {
          const actionName = actionObj.name;
          const args = eventData.arguments || actionObj.arguments || eventData.context || {};
          console.log('Action Name:', actionName, 'Args:', args);
          
          if (actionName === 'whatThisPersonFavFood') {
            responseParts.push(handleSimpleService(args.name || 'someone', isUiMode));
          } else if (actionName === 'compareCar') {
            responseParts.push(handleCompareCarService(args.car1, args.car2, isUiMode));
          } else if (actionName === 'showTransaction') {
            responseParts.push(handleFraudDetectionService(args.username || 'bob', isUiMode, false));
          } else if (actionName === 'showSuspected') {
            responseParts.push(handleFraudDetectionService(args.username || 'bob', isUiMode, true));
          } else if (actionName === 'viewProfile') {
            responseParts.push(handleUserProfileService(args.userId || 'john', args.tab || 'Overview', isUiMode));
          } else if (actionName === 'showSalesDashboard') {
            responseParts.push(handleSalesDashboardService(args.period || 'monthly', isUiMode));
          } else if (actionName === 'showCatalog') {
            responseParts.push(handleProductCatalogService(args.category || 'Electronics', isUiMode));
          } else if (actionName === 'viewProductDetails') {
            responseParts.push(handleProductDetailsService(args.productId || 'P001', isUiMode));
          } else if (actionName === 'trackOrder') {
            responseParts.push(handleOrderTrackingService(args.orderId || 'ORD-12345', isUiMode));
          } else if (actionName === 'calculateLoan') {
            responseParts.push(handleLoanCalculatorService(args.principal || 150000, args.annualRate || 4.5, args.years || 30, isUiMode));
          }
        }
      }
    }

    const response = {
      jsonrpc: "2.0",
      result: {
        status: {
          message: {
            parts: responseParts
          }
        }
      },
      id
    };
    
    return res.json(response);
  } else if (method === 'tools/list') {
    // Basic MCP tools list wrapper via json-rpc method
    return res.json({
      jsonrpc: "2.0",
      result: {
        tools: getToolsList()
      },
      id
    });
  }

  res.status(404).json({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id });
});

// GET /v1/tools endpoint for MCP client connector
app.get('/v1/tools', (req, res) => {
  res.json({
    tools: getToolsList()
  });
});

// POST /v1/tools/call endpoint for MCP client connector
app.post('/v1/tools/call', (req, res) => {
  const { name, arguments: args } = req.body;
  let text = '';

  switch (name) {
    case 'whatThisPersonFavFood':
      text = handleSimpleService(args.name || 'someone', false).text;
      break;
    case 'compareCar':
      text = handleCompareCarService(args.car1 || 'honda', args.car2 || 'toyota', false).text;
      break;
    case 'showTransaction':
      text = handleFraudDetectionService(args.username || 'bob', false, false).text;
      break;
    case 'showSuspected':
      text = handleFraudDetectionService(args.username || 'bob', false, true).text;
      break;
    case 'viewProfile':
      text = handleUserProfileService(args.userId || 'john', args.tab || 'Overview', false).text;
      break;
    case 'showSalesDashboard':
      text = handleSalesDashboardService(args.period || 'monthly', false).text;
      break;
    case 'showCatalog':
      text = handleProductCatalogService(args.category || 'Electronics', false).text;
      break;
    case 'viewProductDetails':
      text = handleProductDetailsService(args.productId || 'P001', false).text;
      break;
    case 'trackOrder':
      text = handleOrderTrackingService(args.orderId || 'ORD-12345', false).text;
      break;
    case 'calculateLoan':
      text = handleLoanCalculatorService(args.principal || 150000, args.annualRate || 4.5, args.years || 30, false).text;
      break;
    default:
      text = `Tool ${name} not found`;
  }

  res.json({
    result: {
      content: [
        {
          type: "text",
          text: text
        }
      ]
    }
  });
});

// Helper for tools list metadata
function getToolsList() {
  return [
    {
      name: "whatThisPersonFavFood",
      description: "Get favorite food of a person",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "Person's name" } },
        required: ["name"]
      }
    },
    {
      name: "compareCar",
      description: "Compare two cars",
      inputSchema: {
        type: "object",
        properties: {
          car1: { type: "string", description: "First car model" },
          car2: { type: "string", description: "Second car model" }
        },
        required: ["car1", "car2"]
      }
    },
    {
      name: "showTransaction",
      description: "Show transaction network knowledge graph for a user",
      inputSchema: {
        type: "object",
        properties: { username: { type: "string", description: "Username to explore" } },
        required: ["username"]
      }
    },
    {
      name: "showSuspected",
      description: "Show suspected fraud alert transaction graph for a user",
      inputSchema: {
        type: "object",
        properties: { username: { type: "string", description: "Username to explore" } },
        required: ["username"]
      }
    },
    {
      name: "viewProfile",
      description: "Display user profile sections",
      inputSchema: {
        type: "object",
        properties: {
          userId: { type: "string", description: "Target User ID" },
          tab: { type: "string", description: "Tab to load (Overview/Activity/Settings/Security)" }
        },
        required: ["userId", "tab"]
      }
    },
    {
      name: "showSalesDashboard",
      description: "View sales dashboard KPIs and trend charts",
      inputSchema: {
        type: "object",
        properties: { period: { type: "string", description: "Time period (daily/weekly/monthly/quarterly)" } },
        required: ["period"]
      }
    },
    {
      name: "showCatalog",
      description: "Browse product catalog listings",
      inputSchema: {
        type: "object",
        properties: { category: { type: "string", description: "Filter category (Electronics/Wearables/Audio)" } },
        required: ["category"]
      }
    },
    {
      name: "viewProductDetails",
      description: "View specific product detail specifications",
      inputSchema: {
        type: "object",
        properties: { productId: { type: "string", description: "Target SKU/Product ID (e.g. P001)" } },
        required: ["productId"]
      }
    },
    {
      name: "trackOrder",
      description: "Track order fulfillment timeline progress",
      inputSchema: {
        type: "object",
        properties: { orderId: { type: "string", description: "Order ID (e.g. ORD-12345)" } },
        required: ["orderId"]
      }
    },
    {
      name: "calculateLoan",
      description: "Calculate loan payment and total interest paid over life",
      inputSchema: {
        type: "object",
        properties: {
          principal: { type: "number", description: "Principal loan amount" },
          annualRate: { type: "number", description: "Annual Interest Rate (%)" },
          years: { type: "number", description: "Loan term length in years" }
        },
        required: ["principal", "annualRate", "years"]
      }
    }
  ];
}

// A2A Well-Known Agent Details
app.get('/.well-known/agent.json', (req, res) => {
  res.json({
    name: "A2UI Node Server",
    version: "1.0.0",
    description: "Replicated Node.js Server for A2UI Demo",
    protocolVersion: "1.0",
    provider: { organization: "Node Port" },
    capabilities: { streaming: false, pushNotifications: false },
    skills: [
      {
        id: "simple",
        name: "Favorite Food Finder",
        description: "Finds the favorite food of a person.",
        tags: ["food", "demo"],
        examples: ["what is vishal favorite food"]
      },
      {
        id: "compare",
        name: "Car Comparison",
        description: "Compares two cars.",
        tags: ["cars"],
        examples: ["compare honda to toyota"]
      },
      {
        id: "fraud",
        name: "Fraud Detection",
        description: "Generates Agentic Knowledge Graphs for fraud detection.",
        tags: ["fraud", "graphs"],
        examples: ["show fraud transactions for vishal", "show suspected fraud for bob"]
      },
      {
        id: "userProfile",
        name: "User Profile Explorer",
        description: "Navigates multi-tab user overview, activity logs, settings, and device listings.",
        tags: ["user", "profile"],
        examples: ["view profile for vishal"]
      },
      {
        id: "salesDashboard",
        name: "Sales Dashboard Viewer",
        description: "Exposes quarterly and monthly KPIs along with sales revenue trends.",
        tags: ["sales", "dashboard", "charts"],
        examples: ["show sales dashboard"]
      },
      {
        id: "productCatalog",
        name: "Product Catalog Browser",
        description: "Provides browsing grids, filtering tools, and detail specification lists.",
        tags: ["catalog", "products"],
        examples: ["show product catalog"]
      },
      {
        id: "orderTracking",
        name: "Order Tracking System",
        description: "Offers stepper status tracking and linear progress bars for deliveries.",
        tags: ["order", "tracking"],
        examples: ["track order ORD-12345"]
      },
      {
        id: "loanCalculator",
        name: "Loan Payment Calculator",
        description: "Calculates interest and payments, providing quick recalculated models.",
        tags: ["calculator", "loan"],
        examples: ["calculate loan payment"]
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
