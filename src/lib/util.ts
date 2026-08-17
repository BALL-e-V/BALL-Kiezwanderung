 
 import { DivIcon, LatLng } from "leaflet";
 import { pointOfInterest } from "./pointOfInterest.svelte";


export function iconmaker(color: string, size: number, id?: string) {
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
  let html
  if(id){
    html = `<span id=${id} style="${markerHtmlStyles}"/>`;
  }else{
    html = `<span style="${markerHtmlStyles}"/>`;
  }

    return new DivIcon({
        className: "my-custom-pin",
        iconAnchor: [0, 12 * size],
        popupAnchor: [0, -36],
        html,
    });
}

export function iconmaker2(color: string, size: number, number: number, id?: string) {
    const markerHtmlStyles = `
  background-color: ${color};
  width: ${size}rem;
  height: ${size}rem;
  display: flex;
  align-items: center;
  justify-content: center;
  left: ${-0.5 * size}rem;
  top: ${-0.5 * size}rem;
  position: relative;
  border-radius: 2rem 2rem 0;
  transform: rotate(45deg);
  border: 1px solid #000000`;
  
  const numberStyles = `
  transform: rotate(-45deg);
  font-weight: bold;
  font-size: ${0.6 * size}rem;
  color: black;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3)`;
  
  let html;
  const spanContent = `<span style="${numberStyles}">${number}</span>`;
  
  if(id){
    html = `<span id=${id} style="${markerHtmlStyles}">${spanContent}</span>`;
  }else{
    html = `<span style="${markerHtmlStyles}">${spanContent}</span>`;
  }

    return new DivIcon({
        className: "my-custom-pin",
        iconAnchor: [0, 12 * size],
        popupAnchor: [0, -36],
        html,
    });
}

 export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          resolve(result);
        } else {
          reject(new Error("Unsupported file reader result type"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
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

  //for sorting the poi list according to the position on the trail
  export function compareTrailPosition(a: pointOfInterest, b: pointOfInterest) {
    if (
      a.trailPosition[0] < b.trailPosition[0] ||
      (a.trailPosition[0] == b.trailPosition[0] &&
        a.trailPosition[1] < b.trailPosition[1])
    ) {
      return -1;
    } else if (
      a.trailPosition[0] > b.trailPosition[0] ||
      (a.trailPosition[0] == b.trailPosition[0] &&
        a.trailPosition[1] > b.trailPosition[1])
    ) {
      return 1;
    } else {
      return 0;
    }
  }