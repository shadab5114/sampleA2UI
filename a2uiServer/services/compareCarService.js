export function handleCompareCarService(car1, car2, isUiMode) {
  car1 = car1 || 'Unknown';
  car2 = car2 || 'Unknown';
  
  let betterCar;
  if (car1.toLowerCase().includes('toyota')) {
    betterCar = car1;
  } else if (car2.toLowerCase().includes('toyota')) {
    betterCar = car2;
  } else {
    betterCar = car1;
  }

  const resultStr = `${betterCar} is better than ${betterCar === car1 ? car2 : car1}`;

  if (isUiMode) {
    return createComparisonUI(car1, car2, betterCar, resultStr);
  } else {
    return { text: resultStr };
  }
}

function createComparisonUI(car1, car2, winner, result) {
  const surfaceId = 'car_comparison';
  const rootId = 'root';

  const components = [
    {
      id: rootId,
      component: {
        Column: {
          children: { explicitList: ['title', 'car1_display', 'car2_display', 'result'] }
        }
      }
    },
    {
      id: 'title',
      component: {
        Text: { text: { literalString: 'Car Comparison' }, usageHint: 'h2' }
      }
    },
    {
      id: 'car1_display',
      component: {
        Text: { text: { literalString: `Car 1: ${car1} ${car1 === winner ? '🏆' : ''}` } }
      }
    },
    {
      id: 'car2_display',
      component: {
        Text: { text: { literalString: `Car 2: ${car2} ${car2 === winner ? '🏆' : ''}` } }
      }
    },
    {
      id: 'result',
      component: {
        Text: { text: { literalString: result }, usageHint: 'body' }
      }
    }
  ];

  return {
    data: {
      updateComponents: {
        surfaceId,
        components
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
