import * as v from 'valibot';

// Valid GeoJSON geometry types
const GeometryTypeParams = v.picklist([
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
    'GeometryCollection'
]);

// Basic Geometry object validation (You could expand coordinates validation if needed)
const GeometrySchema = v.object({
    type: GeometryTypeParams,
    // Coordinates can be numbers, arrays of numbers, arrays of arrays, etc. based on geometry type
    coordinates: v.optional(v.array(v.any())),
    geometries: v.optional(v.array(v.any())) // For GeometryCollection
});

// A single Feature
const FeatureSchema = v.object({
    type: v.literal('Feature'),
    geometry: GeometrySchema, // can also be v.nullable(GeometrySchema)
    properties: v.nullable(v.record(v.string(), v.any()))
});

// A FeatureCollection (most commonly exported by GIS software)
export const GeoJSONSchema = v.object({
    type: v.literal('FeatureCollection'),
    features: v.array(FeatureSchema)
});
