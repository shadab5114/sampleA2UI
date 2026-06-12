import crypto from 'crypto';

const userSurfaceMap = new Map();

export function handleFraudDetectionService(username, isUiMode, isSuspected) {
  if (!isUiMode) {
    return { text: `Fraud Detection for ${username}. Suspected: ${isSuspected}` };
  }

  let surfaceId = userSurfaceMap.get(username);
  if (!surfaceId) {
    if (isSuspected) {
      return { data: { error: `No active transaction surface found for user: ${username}. Please call showTransaction first.` } };
    }
    surfaceId = `fraud-detection-${username}-${crypto.randomUUID().substring(0, 8)}`;
    userSurfaceMap.set(username, surfaceId);
  }

  const rootId = 'root';
  const components = [
    {
      id: rootId,
      component: {
        Column: {
          children: { explicitList: ['fraud-graph'] }
        }
      }
    },
    {
      id: 'fraud-graph',
      component: {
        KnowledgeGraph: {
          title: isSuspected ? `🚨 FRAUD ALERT - Suspicious Network for ${username}` : `🔍 Transaction Network for ${username}`,
          layout: 'cose',
          data: { path: '/fraudData' },
          emits: ['graph.node.selected', 'graph.edge.selected']
        }
      }
    }
  ];

  const fraudDataRaw = getPersonalizedData(username, isSuspected);

  return {
    data: {
      updateComponents: {
        surfaceId,
        components
      },
      updateDataModel: {
        surfaceId,
        contents: [
          {
            key: 'fraudData',
            valueArray: fraudDataRaw
          }
        ]
      },
      createSurface: {
        surfaceId,
        root: rootId,
        viewportWidthPx: 800,
        viewportHeightPx: 600
      }
    },
    metadata: { mimeType: 'application/a2ui+json' }
  };
}

function getPersonalizedData(username, isSuspected) {
  const fraudData = [];
  const u = username.toLowerCase();

  if (u === 'bob') {
    fraudData.push(createNode("0", "bob_acc", "Bob's Account" + (isSuspected ? "\n(HIGH RISK)" : "")));
    fraudData.push(createNode("1", "vpn_node", "VPN Service\n(Encrypted)"));
    fraudData.push(createNode("2", "crypto_ex", "Crypto Exchange\n(High Risk)"));
    fraudData.push(createEdge("3", "bob_acc", "vpn_node", "connects"));
    fraudData.push(createEdge("4", "vpn_node", "crypto_ex", "transfers $5,000"));
    if (isSuspected) {
      fraudData.push(createNode("5", "mule_acc", "Mule Account\n(Flagged)"));
      fraudData.push(createEdge("6", "crypto_ex", "mule_acc", "withdraws"));
    }
  } else if (u === 'vishal') {
    fraudData.push(createNode("0", "acc1", "Vishal's Account" + (isSuspected ? "\n(HIGH RISK)" : "")));
    fraudData.push(createNode("5", "device1", "Device XYZ\n(Shared)"));
    fraudData.push(createNode("6", "merchant", "Electronics Store\n(High Volume)"));
    fraudData.push(createEdge("7", "acc1", "device1", "uses"));
    fraudData.push(createEdge("12", "acc1", "merchant", "$2,500"));
    if (isSuspected) {
      fraudData.push(createNode("1", "acc2", "Account B\n(HIGH RISK)"));
      fraudData.push(createNode("2", "acc3", "Account C\n(Suspicious)"));
      fraudData.push(createEdge("8", "acc2", "device1", "uses"));
      fraudData.push(createEdge("9", "acc3", "device1", "uses"));
      fraudData.push(createEdge("13", "acc2", "merchant", "$2,300"));
    }
  } else {
    fraudData.push(createNode("0", "user_acc", username + "'s Account" + (isSuspected ? "\n(Suspicious)" : "")));
    fraudData.push(createNode("1", "atm_loc", "ATM - Downtown"));
    fraudData.push(createEdge("2", "user_acc", "atm_loc", "withdrawal $200"));
    if (isSuspected) {
      fraudData.push(createNode("3", "unknown_loc", "Unknown Location\n(Foreign IP)"));
      fraudData.push(createEdge("4", "user_acc", "unknown_loc", "login attempt"));
    }
  }
  
  return fraudData;
}

function createNode(key, id, label) {
  return {
    key,
    valueMap: [
      { key: 'id', valueString: id },
      { key: 'label', valueString: label }
    ]
  };
}

function createEdge(key, source, target, label) {
  return {
    key,
    valueMap: [
      { key: 'source', valueString: source },
      { key: 'target', valueString: target },
      { key: 'label', valueString: label }
    ]
  };
}
