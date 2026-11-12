const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (!url.startsWith('https://api.mapbox.com/directions/v5/mapbox/walking/')) {
    return originalFetch(input, init);
  }

  const pathname = decodeURIComponent(new URL(url).pathname);
  const waypointString = pathname.split('/walking/')[1];
  if (!waypointString) {
    throw new Error('Unexpected mocked Mapbox directions URL');
  }

  const coordinates = waypointString
    .split(';')
    .map((point) => point.split(',').map(Number));
  return new Response(
    JSON.stringify({
      routes: [
        {
          legs: [
            {
              steps: coordinates.map((location) => ({
                maneuver: {
                  instruction: 'Test route instruction',
                  location,
                },
              })),
            },
          ],
        },
      ],
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
};
