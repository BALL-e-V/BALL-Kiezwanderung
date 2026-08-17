import { Canvas } from "leaflet";

export const colors = [
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
  ];

  export const highlightColor = "#4895ef";

  export const tooltipSignCount = 120;

  export const initialMapZoom = 13;

  export const initialMapCoordinates = {lat:52.54,lng:13.52};

  export const addPadding = new Canvas({ tolerance: 9 });
  //10^number of digits after the . in km
  export const trailLengthAccuracy = 10;

  export const longTapDelay = 1000; // milliseconds