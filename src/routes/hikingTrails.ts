
export const hikingTrails: { name: string; trail: GeoJSON.FeatureCollection<any>; location: Array<number> }[] =
    [
        {
            location: [52.53631, 13.5473, 14.56],
            name: "random",
            trail: {
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        properties: {},
                        geometry: {
                            coordinates: [
                                [13.543479807587346, 52.53054386152698],
                                [13.546721358635153, 52.53317281141938],
                            ],
                            type: "LineString",
                        },
                    },
                    {
                        type: "Feature",
                        properties: {},
                        geometry: {
                            coordinates: [
                                [13.548619503066163, 52.53700454365986],
                                [13.542058670876855, 52.535136039345076],
                                [13.544878436967252, 52.53912661472464],
                            ],
                            type: "LineString",
                        },
                    },
                    {
                        type: "Feature",
                        properties: {},
                        geometry: {
                            coordinates: [
                                13.551199340472891, 52.53493589797725,
                            ],
                            type: "Point",
                        },
                    },
                    {
                        type: "Feature",
                        properties: {},
                        geometry: {
                            coordinates: [
                                13.540472820402812, 52.53907578567669,
                            ],
                            type: "Point",
                        },
                    },
                ],
            },
        },
        {
            location: [52.53003, 13.54647, 14.9],
            name: "smiley",
            trail: {
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        properties: {},
                        geometry: {
                            coordinates: [
                                [13.539361309488612, 52.529522897889535],
                                [13.5432450857883, 52.52776384398214],
                                [13.549193695680287, 52.527763935609755],
                                [13.55357173017643, 52.530025357728164],
                            ],
                            type: "LineString",
                        },
                    },
                    {
                        type: "Feature",
                        properties: {
                            amenity: "toilet"
                        },
                        geometry: {
                            coordinates: [
                                13.544070899983922, 52.531935190354034,
                            ],
                            type: "Point",
                        },
                    },
                    {
                        type: "Feature",
                        properties: {},
                        geometry: {
                            coordinates: [
                                13.549026468494901, 52.5322870784054,
                            ],
                            type: "Point",
                        },
                    },
                ],
            },
        }
    ]
    ;
