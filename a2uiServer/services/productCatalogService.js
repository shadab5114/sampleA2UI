const productsDb = {
  'P001': { id: 'P001', name: 'Wireless Headphones Pro', category: 'Electronics', price: 299.99, rating: '⭐⭐⭐⭐⭐', stock: 45 },
  'P002': { id: 'P002', name: 'Smart Fitness Watch', category: 'Wearables', price: 199.99, rating: '⭐⭐⭐⭐', stock: 120 },
  'P003': { id: 'P003', name: 'Portable Bluetooth Speaker', category: 'Audio', price: 89.99, rating: '⭐⭐⭐⭐⭐', stock: 78 }
};

export function handleProductCatalogService(category, isUiMode) {
  category = category || 'Electronics';
  const textResult = `Showing products in category: ${category}`;

  if (isUiMode) {
    return createCatalogGridUI(category);
  } else {
    return { text: textResult };
  }
}

export function handleProductDetailsService(productId, isUiMode) {
  const p = productsDb[productId] || { id: productId, name: 'Unknown Product', category: 'Other', price: 0, rating: '⭐', stock: 0 };
  const textResult = `${p.name} - $${p.price} (Stock: ${p.stock})`;

  if (isUiMode) {
    return createProductDetailUI(p);
  } else {
    return { text: textResult };
  }
}

function createCatalogGridUI(category) {
  const surfaceId = 'product_catalog_grid';
  const rootId = 'root';

  const list = Object.values(productsDb).filter(p => !category || p.category.toLowerCase() === category.toLowerCase() || category === 'All');
  const productsToRender = list.length > 0 ? list : Object.values(productsDb);

  const childIds = [
    "header", "category_badge", "total_products", "divider1", "grid_title"
  ];

  for (let i = 0; i < productsToRender.length; i++) {
    const idx = String(i + 1);
    childIds.push(
      `card${idx}_title`, `card${idx}_price`, `card${idx}_rating`, `card${idx}_stock`, 
      `card${idx}_button`, `card${idx}_divider`
    );
  }

  childIds.push("divider2", "filter_section", "category_input", "filter_button");

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
      component: { Text: { text: { literalString: "🛍️ Product Catalog" }, usageHint: "h1" } }
    },
    {
      id: "category_badge",
      component: { Text: { text: { literalString: `🏷️ Category: ${category}` }, usageHint: "h2" } }
    },
    {
      id: "total_products",
      component: { Text: { text: { literalString: `📦 ${productsToRender.length} products available` }, usageHint: "body" } }
    },
    {
      id: "divider1",
      component: { Text: { text: { literalString: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" }, usageHint: "body" } }
    },
    {
      id: "grid_title",
      component: { Text: { text: { literalString: "Featured Products:" }, usageHint: "h2" } }
    }
  ];

  const dataModel = [
    { key: "catalog", valueMap: [
      { key: "filter", valueMap: [{ key: "category", valueString: category }] }
    ] }
  ];

  productsToRender.forEach((p, i) => {
    const idx = String(i + 1);
    const stockStatus = p.stock > 50 ? " ✅ In Stock" : p.stock > 10 ? " ⚠️ Low Stock" : " ❌ Limited";

    components.push(
      {
        id: `card${idx}_title`,
        component: { Text: { text: { literalString: `📦 ${p.name}` }, usageHint: "h3" } }
      },
      {
        id: `card${idx}_price`,
        component: { Text: { text: { literalString: `💵 Price: $${p.price.toFixed(2)}` }, usageHint: "body" } }
      },
      {
        id: `card${idx}_rating`,
        component: { Text: { text: { literalString: `Rating: ${p.rating}` }, usageHint: "body" } }
      },
      {
        id: `card${idx}_stock`,
        component: { Text: { text: { literalString: `📊 Stock: ${p.stock}${stockStatus}` }, usageHint: "body" } }
      },
      {
        id: `card${idx}_button_text`,
        component: { Text: { text: { literalString: "🔍 View Details" } } }
      },
      {
        id: `card${idx}_button`,
        component: {
          Button: {
            child: `card${idx}_button_text`,
            action: {
              name: "viewProductDetails",
              contextBindings: {
                productId: { path: `/catalog/product${idx}/id` }
              }
            }
          }
        }
      },
      {
        id: `card${idx}_divider`,
        component: { Text: { text: { literalString: "─────────────────────────" }, usageHint: "body" } }
      }
    );

    // Inject exact product ID inside valueMap of catalog path
    dataModel.push({
      key: `catalog/product${idx}`,
      valueMap: [{ key: "id", valueString: p.id }]
    });
  });

  components.push(
    {
      id: "divider2",
      component: { Text: { text: { literalString: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" }, usageHint: "body" } }
    },
    {
      id: "filter_section",
      component: { Text: { text: { literalString: "🔎 Filter Products:" }, usageHint: "h3" } }
    },
    {
      id: "category_input",
      component: { TextField: { label: { literalString: "Category (Electronics/Wearables/Audio)" }, value: { path: "/catalog/filter/category" } } }
    },
    {
      id: "filter_button_text",
      component: { Text: { text: { literalString: "🎯 Apply Filter" } } }
    },
    {
      id: "filter_button",
      component: {
        Button: {
          child: "filter_button_text",
          action: {
            name: "showCatalog",
            contextBindings: {
              category: { path: "/catalog/filter/category" }
            }
          }
        }
      }
    }
  );

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

function createProductDetailUI(product) {
  const surfaceId = 'product_details';
  const rootId = 'root';

  const childIds = [
    "header", "product_name", "divider1",
    "details_section", "sku", "price", "rating", "stock_status",
    "divider2", "description_title", "desc1", "desc2", "desc3",
    "divider3", "features_title", "feature1", "feature2", "feature3", "feature4",
    "divider4", "actions_title", "qty_label", "qty_input",
    "add_cart_button", "back_button"
  ];

  const stockEmoji = product.stock > 50 ? "✅" : product.stock > 10 ? "⚠️" : "🚨";
  const stockText = product.stock > 50 ? "In Stock" : product.stock > 10 ? "Limited Stock" : "Low Stock - Order Soon!";

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
      component: { Text: { text: { literalString: "🎁 Product Details" }, usageHint: "h1" } }
    },
    {
      id: "product_name",
      component: { Text: { text: { literalString: product.name }, usageHint: "h2" } }
    },
    {
      id: "divider1",
      component: { Text: { text: { literalString: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" }, usageHint: "body" } }
    },
    {
      id: "details_section",
      component: { Text: { text: { literalString: "📋 Product Information:" }, usageHint: "h3" } }
    },
    {
      id: "sku",
      component: { Text: { text: { literalString: `SKU: ${product.id}` }, usageHint: "body" } }
    },
    {
      id: "price",
      component: { Text: { text: { literalString: `💰 Price: $${product.price.toFixed(2)}` }, usageHint: "h3" } }
    },
    {
      id: "rating",
      component: { Text: { text: { literalString: `Customer Rating: ${product.rating}` }, usageHint: "body" } }
    },
    {
      id: "stock_status",
      component: { Text: { text: { literalString: `${stockEmoji} Availability: ${stockText} (${product.stock} units)` }, usageHint: "body" } }
    },
    {
      id: "divider2",
      component: { Text: { text: { literalString: "─────────────────────────" }, usageHint: "body" } }
    },
    {
      id: "description_title",
      component: { Text: { text: { literalString: "📝 Description:" }, usageHint: "h3" } }
    },
    {
      id: "desc1",
      component: { Text: { text: { literalString: `Premium quality ${product.name} designed for excellence.` }, usageHint: "body" } }
    },
    {
      id: "desc2",
      component: { Text: { text: { literalString: "Perfect for everyday use with industry-leading performance." }, usageHint: "body" } }
    },
    {
      id: "desc3",
      component: { Text: { text: { literalString: "Backed by our satisfaction guarantee and 2-year warranty." }, usageHint: "body" } }
    },
    {
      id: "divider3",
      component: { Text: { text: { literalString: "─────────────────────────" }, usageHint: "body" } }
    },
    {
      id: "features_title",
      component: { Text: { text: { literalString: "✨ Key Features:" }, usageHint: "h3" } }
    },
    {
      id: "feature1",
      component: { Text: { text: { literalString: "✓ Premium Build Quality" }, usageHint: "body" } }
    },
    {
      id: "feature2",
      component: { Text: { text: { literalString: "✓ Advanced Technology" }, usageHint: "body" } }
    },
    {
      id: "feature3",
      component: { Text: { text: { literalString: "✓ User-Friendly Design" }, usageHint: "body" } }
    },
    {
      id: "feature4",
      component: { Text: { text: { literalString: "✓ Free Shipping & Returns" }, usageHint: "body" } }
    },
    {
      id: "divider4",
      component: { Text: { text: { literalString: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" }, usageHint: "body" } }
    },
    {
      id: "actions_title",
      component: { Text: { text: { literalString: "🛒 Purchase Options:" }, usageHint: "h3" } }
    },
    {
      id: "qty_label",
      component: { Text: { text: { literalString: "Select Quantity:" }, usageHint: "body" } }
    },
    {
      id: "qty_input",
      component: { TextField: { label: { literalString: `Quantity (1-${Math.min(10, product.stock)})` }, value: { path: "/product/quantity" } } }
    },
    {
      id: "add_cart_text",
      component: { Text: { text: { literalString: "🛒 Add to Cart" } } }
    },
    {
      id: "add_cart_button",
      component: {
        Button: {
          child: "add_cart_text",
          action: {
            name: "showCatalog",
            contextBindings: {
              category: { path: "/product/category" }
            }
          }
        }
      }
    },
    {
      id: "back_text",
      component: { Text: { text: { literalString: "◀️ Back to Catalog" } } }
    },
    {
      id: "back_button",
      component: {
        Button: {
          child: "back_text",
          action: {
            name: "showCatalog",
            contextBindings: {
              category: { path: "/product/category" }
            }
          }
        }
      }
    }
  ];

  const dataModel = [
    { key: "product", valueMap: [
      { key: "quantity", valueString: "1" },
      { key: "category", valueString: product.category }
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
