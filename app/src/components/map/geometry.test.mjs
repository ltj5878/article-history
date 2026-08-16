import test from 'node:test';
import assert from 'node:assert/strict';

import { clipRouteCoords, createRouteSourceData, createTerritoryData } from './geometry.js';

test('clipRouteCoords returns an empty feature source for empty routes', () => {
  assert.deepEqual(clipRouteCoords([], 0), []);
  assert.deepEqual(clipRouteCoords([], 0.5), []);
});

test('clipRouteCoords does not emit undefined for progress zero', () => {
  const points = [
    { lng: 116, lat: 35 },
    { lng: 117, lat: 36 },
  ];

  assert.deepEqual(clipRouteCoords(points, 0), [[116, 35]]);
});

test('createRouteSourceData clips each route independently', () => {
  const data = createRouteSourceData([
    {
      color: '#C41E24',
      dashed: true,
      points: [
        { lng: 0, lat: 0 },
        { lng: 1, lat: 0 },
      ],
    },
  ], 0.5);

  assert.equal(data.features[0].geometry.coordinates.length, 2);
  assert.deepEqual(data.features[0].geometry.coordinates[1], [0.5, 0]);
});

test('createTerritoryData drops invalid polygons instead of crashing', () => {
  assert.deepEqual(
    createTerritoryData([{ name: 'invalid', color: '#000', polygon: [] }]),
    { type: 'FeatureCollection', features: [] },
  );
  assert.equal(createTerritoryData(undefined).features.length, 0);
});
