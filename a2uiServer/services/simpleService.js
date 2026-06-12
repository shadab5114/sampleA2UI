export function handleSimpleService(name, isUiMode) {
  let favFood;
  if (name.toLowerCase() === 'vishal') {
    favFood = 'Paneer Butter Masala';
  } else if (name.toLowerCase() === 'vinod') {
    favFood = 'aloo kofta';
  } else {
    favFood = 'something yummy';
  }

  if (isUiMode) {
    return createFavoriteFoodUI(name, favFood);
  } else {
    return { text: `${name}'s favorite food is: ${favFood}` };
  }
}

function createFavoriteFoodUI(name, favFood) {
  const surfaceId = 'favorite_food';
  const rootId = 'root';

  const components = [
    {
      id: rootId,
      component: {
        Column: {
          children: { explicitList: ['title', 'result', 'divider', 'form_title', 'name_input', 'submit_button', 'submit_button_text'] }
        }
      }
    },
    {
      id: 'title',
      component: {
        Text: { text: { literalString: '🍽️ Favorite Food Finder' }, usageHint: 'h2' }
      }
    },
    {
      id: 'result',
      component: {
        Text: { text: { literalString: `${name}'s favorite food is: ${favFood} 😋` }, usageHint: 'body' }
      }
    },
    {
      id: 'divider',
      component: {
        Text: { text: { literalString: '───────────────────────' }, usageHint: 'body' }
      }
    },
    {
      id: 'form_title',
      component: {
        Text: { text: { literalString: "Find another person's favorite food:" }, usageHint: 'h3' }
      }
    },
    {
      id: 'name_input',
      component: {
        TextField: { label: { literalString: "Person's Name" }, value: { path: '/form/name' } }
      }
    },
    {
      id: 'submit_button_text',
      component: {
        Text: { text: { literalString: 'Find Favorite Food' } }
      }
    },
    {
      id: 'submit_button',
      component: {
        Button: {
          child: 'submit_button_text',
          action: {
            name: 'whatThisPersonFavFood',
            contextBindings: {
              name: { path: '/form/name' }
            }
          }
        }
      }
    }
  ];

  const dataModel = [
    {
      key: 'form',
      valueMap: [
        { key: 'name', valueString: '' }
      ]
    }
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
