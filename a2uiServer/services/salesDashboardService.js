export function handleSalesDashboardService(period, isUiMode) {
  period = period || 'monthly';
  
  const metrics = calculateMetrics(period);
  const textResult = `Sales Dashboard - Period: ${period}, Total: $${metrics.totalSales.toLocaleString()}, Growth: ${metrics.growthRate}%`;

  if (isUiMode) {
    return createDashboardUI(period, metrics);
  } else {
    return { text: textResult };
  }
}

function calculateMetrics(period) {
  return {
    totalSales: 245780,
    newCustomers: 342,
    avgOrderValue: 718.48,
    growthRate: 18.5,
    conversionRate: 3.2,
    activeUsers: 1247
  };
}

function createDashboardUI(period, metrics) {
  const surfaceId = 'sales_dashboard';
  const rootId = 'root';

  const childIds = [
    "header", "period_badge", "divider1",
    "kpi_section_title", 
    "metric_sales", "metric_customers", "metric_avg_order",
    "metric_growth", "metric_conversion", "metric_active_users",
    "divider2", "chart_section", "sales-chart",
    "divider3", "controls_title", 
    "period_input", "export_button", "refresh_button"
  ];

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
      component: { Text: { text: { literalString: "📊 Sales Performance Dashboard" }, usageHint: "h1" } }
    },
    {
      id: "period_badge",
      component: { Text: { text: { literalString: `📅 Reporting Period: ${period.toUpperCase()}` }, usageHint: "h3" } }
    },
    {
      id: "divider1",
      component: { Text: { text: { literalString: "═══════════════════════════════════════════" }, usageHint: "body" } }
    },
    {
      id: "kpi_section_title",
      component: { Text: { text: { literalString: "🎯 Key Performance Indicators" }, usageHint: "h2" } }
    },
    {
      id: "metric_sales",
      component: { Text: { text: { literalString: `💰 Total Revenue: $${metrics.totalSales.toLocaleString()}` }, usageHint: "h3" } }
    },
    {
      id: "metric_customers",
      component: { Text: { text: { literalString: `👥 New Customers: ${metrics.newCustomers}` }, usageHint: "h3" } }
    },
    {
      id: "metric_avg_order",
      component: { Text: { text: { literalString: `🛒 Avg Order Value: $${metrics.avgOrderValue.toFixed(2)}` }, usageHint: "h3" } }
    },
    {
      id: "metric_growth",
      component: { Text: { text: { literalString: `📈 Growth Rate: ${metrics.growthRate}% (Excellent!)` }, usageHint: "h3" } }
    },
    {
      id: "metric_conversion",
      component: { Text: { text: { literalString: `🎯 Conversion Rate: ${metrics.conversionRate}%` }, usageHint: "h3" } }
    },
    {
      id: "metric_active_users",
      component: { Text: { text: { literalString: `🌟 Active Users: ${metrics.activeUsers.toLocaleString()}` }, usageHint: "h3" } }
    },
    {
      id: "divider2",
      component: { Text: { text: { literalString: "═══════════════════════════════════════════" }, usageHint: "body" } }
    },
    {
      id: "chart_section",
      component: { Text: { text: { literalString: "📈 Trend Analysis" }, usageHint: "h2" } }
    },
    {
      id: "sales-chart",
      component: {
        Graph: {
          title: "Sales Revenue Trend",
          graphType: "line",
          interactive: true,
          xLabel: "Reporting Day",
          yLabel: "Sales ($)",
          data: { path: "/dashboard/chartData" },
          emits: ["graph.point.selected"]
        }
      }
    },
    {
      id: "divider3",
      component: { Text: { text: { literalString: "═══════════════════════════════════════════" }, usageHint: "body" } }
    },
    {
      id: "controls_title",
      component: { Text: { text: { literalString: "⚙️ Dashboard Controls" }, usageHint: "h3" } }
    },
    {
      id: "period_input",
      component: { TextField: { label: { literalString: "Change Period (daily/weekly/monthly/quarterly)" }, value: { path: "/dashboard/period" } } }
    },
    {
      id: "export_text",
      component: { Text: { text: { literalString: "📥 Export Data" } } }
    },
    {
      id: "export_button",
      component: {
        Button: {
          child: "export_text",
          action: {
            name: "showSalesDashboard",
            contextBindings: {
              period: { path: "/dashboard/period" }
            }
          }
        }
      }
    },
    {
      id: "refresh_text",
      component: { Text: { text: { literalString: "🔄 Refresh Dashboard" } } }
    },
    {
      id: "refresh_button",
      component: {
        Button: {
          child: "refresh_text",
          action: {
            name: "showSalesDashboard",
            contextBindings: {
              period: { path: "/dashboard/period" }
            }
          }
        }
      }
    }
  ];

  const chartData = [
    { key: "0", valueMap: [{ key: "x", valueString: "Mon" }, { key: "y", valueNumber: 12000 }] },
    { key: "1", valueMap: [{ key: "x", valueString: "Tue" }, { key: "y", valueNumber: 15000 }] },
    { key: "2", valueMap: [{ key: "x", valueString: "Wed" }, { key: "y", valueNumber: 18000 }] },
    { key: "3", valueMap: [{ key: "x", valueString: "Thu" }, { key: "y", valueNumber: 14000 }] },
    { key: "4", valueMap: [{ key: "x", valueString: "Fri" }, { key: "y", valueNumber: 22000 }] },
    { key: "5", valueMap: [{ key: "x", valueString: "Sat" }, { key: "y", valueNumber: 25000 }] },
    { key: "6", valueMap: [{ key: "x", valueString: "Sun" }, { key: "y", valueNumber: 21000 }] }
  ];

  const dataModel = [
    { key: "dashboard", valueMap: [
      { key: "period", valueString: period },
      { key: "chartData", valueArray: chartData }
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
