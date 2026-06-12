export function handleOrderTrackingService(orderId, isUiMode) {
  orderId = orderId || 'ORD-99999';

  const timeline = [
    "Jan 8, 10:30 AM", "Jan 8, 2:45 PM", "Jan 9, 8:00 AM",
    "Jan 10, 6:30 AM", "", ""
  ];
  const currentStep = 3; // Index 3 is "Shipped"
  const estimatedDelivery = "Jan 12, 2026";
  const customerName = "John Doe";

  const textResult = `Order ${orderId} is at step ${currentStep + 1} of 6`;

  if (isUiMode) {
    return createOrderTrackingUI(orderId, customerName, currentStep, estimatedDelivery, timeline);
  } else {
    return { text: textResult };
  }
}

function createOrderTrackingUI(orderId, customerName, currentStep, estimatedDelivery, timeline) {
  const surfaceId = 'order_tracker';
  const rootId = 'root';

  const stepNames = [
    "Order Placed", "Payment Confirmed", "Processing", 
    "Shipped", "Out for Delivery", "Delivered"
  ];
  
  const stepDescriptions = [
    "Your order has been received",
    "Payment processed successfully",
    "Order is being prepared",
    "Package is on the way",
    "Delivery in progress",
    "Order completed"
  ];

  const childIds = [
    "header", "order_id", "customer_name", "estimated_delivery", "divider1",
    "progress_title", "progress_bar"
  ];

  for (let i = 0; i < stepNames.length; i++) {
    childIds.push(`step_${i}_status`);
    childIds.push(`step_${i}_name`);
    childIds.push(`step_${i}_desc`);
    childIds.push(`step_${i}_time`);
    if (i < stepNames.length - 1) {
      childIds.push(`connector_${i}`);
    }
  }

  childIds.push("divider2", "track_another_title", "order_input", "track_button");

  const components = [
    {
      id: rootId,
      component: {
        Column: {
          children: { explicitList: childIds }
        }
      }
    },
    {
      id: "header",
      component: { Text: { text: { literalString: "📦 Order Tracking" }, usageHint: "h1" } }
    },
    {
      id: "order_id",
      component: { Text: { text: { literalString: `Order ID: ${orderId}` }, usageHint: "h2" } }
    },
    {
      id: "customer_name",
      component: { Text: { text: { literalString: `👤 Customer: ${customerName}` }, usageHint: "body" } }
    },
    {
      id: "estimated_delivery",
      component: { Text: { text: { literalString: `📅 Estimated Delivery: ${estimatedDelivery}` }, usageHint: "h3" } }
    },
    {
      id: "divider1",
      component: { Text: { text: { literalString: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" }, usageHint: "body" } }
    },
    {
      id: "progress_title",
      component: { Text: { text: { literalString: "🔄 Order Progress:" }, usageHint: "h2" } }
    }
  ];

  // Progress bar string
  const progressPercent = ((currentStep + 1) * 100.0) / stepNames.length;
  const filled = Math.round(progressPercent / 10);
  let bar = "[";
  for (let i = 0; i < 10; i++) {
    bar += i < filled ? "█" : "░";
  }
  bar += "]";
  const progressBarText = `${bar} ${progressPercent.toFixed(0)}% Complete`;

  components.push({
    id: "progress_bar",
    component: { Text: { text: { literalString: progressBarText }, usageHint: "h3" } }
  });

  // Stepper
  for (let i = 0; i < stepNames.length; i++) {
    let emoji, statusText, timeText;
    
    if (i < currentStep) {
      emoji = "✅";
      statusText = "Completed";
      timeText = "⏰ " + timeline[i];
    } else if (i === currentStep) {
      emoji = "🔄";
      statusText = "In Progress";
      timeText = timeline[i] === "" ? "⏳ Processing..." : "⏰ " + timeline[i];
    } else {
      emoji = "⭕";
      statusText = "Pending";
      timeText = "⏳ Awaiting";
    }

    components.push({
      id: `step_${i}_status`,
      component: { Text: { text: { literalString: `${emoji} [${statusText}]` }, usageHint: "h3" } }
    });
    components.push({
      id: `step_${i}_name`,
      component: { Text: { text: { literalString: `Step ${i + 1}: ${stepNames[i]}` }, usageHint: "h3" } }
    });
    components.push({
      id: `step_${i}_desc`,
      component: { Text: { text: { literalString: `   ${stepDescriptions[i]}` }, usageHint: "body" } }
    });
    components.push({
      id: `step_${i}_time`,
      component: { Text: { text: { literalString: `   ${timeText}` }, usageHint: "body" } }
    });

    if (i < stepNames.length - 1) {
      const connector = i < currentStep ? "   ┃" : "   ┆";
      components.push({
        id: `connector_${i}`,
        component: { Text: { text: { literalString: connector }, usageHint: "body" } }
      });
    }
  }

  components.push(
    {
      id: "divider2",
      component: { Text: { text: { literalString: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" }, usageHint: "body" } }
    },
    {
      id: "track_another_title",
      component: { Text: { text: { literalString: "🔍 Track Another Order:" }, usageHint: "h3" } }
    },
    {
      id: "order_input",
      component: { TextField: { label: { literalString: "Enter Order ID" }, value: { path: "/tracking/orderId" } } }
    },
    {
      id: "track_button_text",
      component: { Text: { text: { literalString: "📍 Track Order" } } }
    },
    {
      id: "track_button",
      component: {
        Button: {
          child: "track_button_text",
          action: {
            name: "trackOrder",
            contextBindings: {
              orderId: { path: "/tracking/orderId" }
            }
          }
        }
      }
    }
  );

  const dataModel = [
    { key: "tracking", valueMap: [
      { key: "orderId", valueString: "" }
    ] }
  ];

  return {
    data: {
      updateComponents: {
        surfaceId,
        components
      },
      updateDataModel: {
        surfaceId,
        contents: dataModel
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
