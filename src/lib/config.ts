import { Canvas } from "leaflet";

export const colors = {
  trailPalette: [
    "#f72585",
    "#b5179e",
    "#3f37c9",
    "#7209b7",
    "#560bad",
    "#480ca8",
    "#4895ef",
    "#4361ee",
    "#4cc9f0",
    "#3a0ca3",
  ],
  highlight: "#4895ef",
  trailStart: "green",
  trailEnd: "white",
  movableMarker: "blue",
  editing: "orange",
  poi: "yellow",
  buildTrail: "black",
  path: "#3388ff",
  inactiveTrail: "darkblue",
  inactivePoi: "lightgray",
};

export const wanderwegeConfig = {
  colors,
  tooltipSignCount: 120,
  initialMapZoom: 13,
  initialMapCoordinates: { lat: 52.54, lng: 13.52 },
  addPadding: new Canvas({ tolerance: 9 }),
  trailLengthAccuracy: 10,
  longTapDelay: 1000,
  print: {
    descriptionFontSize: 12,
    trailTitleFontSize: 18,
    poiTitleFontSize: 14,
    poiImageArea: 60 * 45,
    startEndSize: 2,
    poiSize: 3,
    margins: {
      mapContent: 3,
      titleDescription: 8,
      contentBlock: 8,
      continuationTitleDescription: 10,
      poiTitle: 4,
      poiDescription: 2,
      imageDescription: 7,
      imageText: 8,
    },
  },
};

export const wanderwegErstellenConfig = {
  colors,
  sizes: {
    trailMarker: 1.2,
    activeTrailend: 1.5,
    poi: 1.5,
    poiHero: 2,
    buildTrail: 3,
    clickableTrail: 4,
    inactiveTrail: 2,
    inactivePoi: 1,
  },
  timeToSave: 5000,
  trailResolution: 40,
  showFailureTime:3000,
  poiDraggingDelay:200,
};

export const userConfig ={
    displayResponseTime:5000
}

export const layoutConfig = {
  longPressTime: 450,
};