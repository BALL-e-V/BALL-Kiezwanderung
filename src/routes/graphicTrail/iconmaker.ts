import { DivIcon } from "leaflet";

export function iconmaker(color: string, size: number) {
  const markerHtmlStyles = `
  background-color: ${color};
  width: ${size}rem;
  height: ${size}rem;
  display: block;
  left: ${-0.5 * size}rem;
  top: ${-0.5 * size}rem;
  position: relative;
  border-radius: 2rem 2rem 0;
  transform: rotate(45deg);
  border: 1px solid #000000`;

  return new DivIcon({
    className: "my-custom-pin",
    iconAnchor: [0, 12 * size],
    popupAnchor: [0, -36],
    html: `<span style="${markerHtmlStyles}"/>`,
  });
}