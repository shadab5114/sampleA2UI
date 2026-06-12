export function handleLoanCalculatorService(principal, annualRate, years, isUiMode) {
  principal = parseFloat(principal) || 0;
  annualRate = parseFloat(annualRate) || 0;
  years = parseInt(years) || 0;

  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  let monthlyPayment = 0;
  if (monthlyRate > 0 && months > 0) {
    monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) 
                   / (Math.pow(1 + monthlyRate, months) - 1);
  } else if (months > 0) {
    monthlyPayment = principal / months;
  }
  const totalPayment = monthlyPayment * months;
  const totalInterest = totalPayment - principal;

  const textResult = `Monthly Payment: $${monthlyPayment.toFixed(2)}, Total Interest: $${totalInterest.toFixed(2)}`;

  if (isUiMode) {
    return createLoanResultUI(principal, annualRate, years, monthlyPayment, totalPayment, totalInterest);
  } else {
    return { text: textResult };
  }
}

function createLoanResultUI(principal, rate, years, monthly, total, interest) {
  const surfaceId = 'loan_calculator';
  const rootId = 'root';

  const formatCurrency = (val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercent = (val) => `${val.toFixed(2)}%`;

  const childIds = [
    "header", "calc_icon", "divider1",
    "input_section", "input_principal", "input_rate", "input_years",
    "divider2", "results_section",
    "result_monthly", "result_total", "result_interest", "result_breakdown",
    "divider3", "comparison_title", "comparison_info",
    "divider4", "recalc_section",
    "new_principal", "new_rate", "new_years",
    "calc_button"
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
      component: { Text: { text: { literalString: "🏦 Loan Payment Calculator" }, usageHint: "h1" } }
    },
    {
      id: "calc_icon",
      component: { Text: { text: { literalString: "💰 Calculate your monthly payments and total interest" }, usageHint: "body" } }
    },
    {
      id: "divider1",
      component: { Text: { text: { literalString: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" }, usageHint: "body" } }
    },
    {
      id: "input_section",
      component: { Text: { text: { literalString: "📝 Loan Details:" }, usageHint: "h2" } }
    },
    {
      id: "input_principal",
      component: { Text: { text: { literalString: `💵 Loan Amount: ${formatCurrency(principal)}` }, usageHint: "h3" } }
    },
    {
      id: "input_rate",
      component: { Text: { text: { literalString: `📊 Annual Interest Rate: ${formatPercent(rate)}` }, usageHint: "h3" } }
    },
    {
      id: "input_years",
      component: { Text: { text: { literalString: `⏱️ Loan Term: ${years} years (${years * 12} months)` }, usageHint: "h3" } }
    },
    {
      id: "divider2",
      component: { Text: { text: { literalString: "─────────────────────────" }, usageHint: "body" } }
    },
    {
      id: "results_section",
      component: { Text: { text: { literalString: "📈 Calculation Results:" }, usageHint: "h2" } }
    },
    {
      id: "result_monthly",
      component: { Text: { text: { literalString: `💳 Monthly Payment: ${formatCurrency(monthly)}` }, usageHint: "h2" } }
    },
    {
      id: "result_total",
      component: { Text: { text: { literalString: `💰 Total Payment: ${formatCurrency(total)}` }, usageHint: "h3" } }
    },
    {
      id: "result_interest",
      component: { Text: { text: { literalString: `📊 Total Interest: ${formatCurrency(interest)}` }, usageHint: "h3" } }
    },
    {
      id: "result_breakdown",
      component: {
        Text: {
          text: { literalString: `ℹ️  You will pay ${principal > 0 ? ((interest / principal) * 100).toFixed(1) : 0}% more than the original loan amount` },
          usageHint: "body"
        }
      }
    },
    {
      id: "divider3",
      component: { Text: { text: { literalString: "─────────────────────────" }, usageHint: "body" } }
    },
    {
      id: "comparison_title",
      component: { Text: { text: { literalString: "💡 Payment Breakdown:" }, usageHint: "h3" } }
    },
    {
      id: "comparison_info",
      component: {
        Text: {
          text: { literalString: `Principal per month: ${formatCurrency(months > 0 ? principal / months : 0)} | Interest per month: ${formatCurrency(months > 0 ? interest / months : 0)}` },
          usageHint: "body"
        }
      }
    },
    {
      id: "divider4",
      component: { Text: { text: { literalString: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" }, usageHint: "body" } }
    },
    {
      id: "recalc_section",
      component: { Text: { text: { literalString: "🔄 Calculate Another Loan:" }, usageHint: "h3" } }
    },
    {
      id: "new_principal",
      component: { TextField: { label: { literalString: "Loan Amount ($)" }, value: { path: "/calculator/principal" } } }
    },
    {
      id: "new_rate",
      component: { TextField: { label: { literalString: "Annual Interest Rate (%)" }, value: { path: "/calculator/rate" } } }
    },
    {
      id: "new_years",
      component: { TextField: { label: { literalString: "Loan Term (years)" }, value: { path: "/calculator/years" } } }
    },
    {
      id: "calc_button_text",
      component: { Text: { text: { literalString: "🧮 Calculate Payment" } } }
    },
    {
      id: "calc_button",
      component: {
        Button: {
          child: "calc_button_text",
          action: {
            name: "calculateLoan",
            contextBindings: {
              principal: { path: "/calculator/principal" },
              annualRate: { path: "/calculator/rate" },
              years: { path: "/calculator/years" }
            }
          }
        }
      }
    }
  ];

  const dataModel = [
    { key: "calculator", valueMap: [
      { key: "principal", valueString: String(principal) },
      { key: "rate", valueString: String(rate) },
      { key: "years", valueString: String(years) }
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
