import { DivIcon, LatLng } from "leaflet";

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


export function responseToLatlngs(response: any, trailResolution: number) {
    //need to swap coordinates and turn them into latlngs
    let coords = response.routes[0].geometry.coordinates;
    let latlngs = [new LatLng(coords[0][1], coords[0][0])];
    let latlng: LatLng;
    for (let i = 1; i < coords.length; i++) {
        latlng = new LatLng(coords[i][1], coords[i][0]);
        //checking how far apart this and the last point are
        let distance = latlng.distanceTo(latlngs[latlngs.length - 1]);

        //interpolating extra spots in the trail if 2 coordinate points are too far apart, so the location of a point of interest can be assigned properly
        if (distance > trailResolution) {
            let latIncrement =
                (coords[i][1] - coords[i - 1][1]) /
                Math.ceil(distance / trailResolution);
            let lngIncrement =
                (coords[i][0] - coords[i - 1][0]) /
                Math.ceil(distance / trailResolution);
            for (
                let j = 1;
                j < Math.ceil(distance / trailResolution);
                j++
            ) {
                //its not quite a straight/grand circle line but close enough for the distances we deal with
                latlngs.push(
                    new LatLng(
                        coords[i - 1][1] + j * latIncrement,
                        coords[i - 1][0] + j * lngIncrement,
                    ),
                );
            }
        }
        //adding the new point to the latlngs
        latlngs.push(latlng);
    }

    return latlngs;
}
//function to turn latlngs into a transferable dataobject
export function latlngsToDataobject(latlngs: LatLng[]) {
    let coordinates: { lat: number; lng: number }[] = [];
    latlngs.forEach((l) =>
        coordinates.push({ lat: l.lat as number, lng: l.lng as number }),
    );
    return coordinates;
}