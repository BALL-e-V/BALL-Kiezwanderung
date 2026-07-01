  import {Marker,LatLng,Map, Polyline}from "leaflet"
  import { iconmaker } from "../routes/graphicTrail/utils";
  import{colors,sizes}from "../routes/graphicTrail/config"
  
 export class pointOfInterest {
    //caption
    caption = $state("Foto");
    imageUrl = $state("");
    description = $state("");
    imageAlt =$state("");
    //keeping lat and lng separately to write them into the database later
    lat: number;
    lng: number;
    //serial uuid assigned by the database
    id = "";
    //leaflet marker to display the poi on the map and for interaction
    marker: Marker;
    // the position of the polyline in trail, and the position of the latlng in the latlng array of the polyline which is closest to the point of interest
    trailPosition = [0, 0];
    author="";
    editor="";
    created= Date.now();
    edited=Date.now();

    constructor(
      //the poi needs at least a position on the map, the map element and a caption to be displayed in the list
      map: Map,
      latlng: { lat: number; lng: number },
    ) {
      this.lat = latlng.lat;
      this.lng = latlng.lng;
      this.marker = new Marker(latlng, { draggable: false });

      this.marker.addTo(map);
      this.marker.setIcon(iconmaker(colors.poi, sizes.poi));
    }
    //position of the closest coordinate in the array of latlngs of the polylines in the trail, saved as the position of the poi in the trail for sorting and display purposes
    getTrailPosition(trail:Polyline[]) {
      let latlngs: LatLng[];
      let distance = 1000;
      let d:number;
      for (let i = 0; i < trail.length; i++) {
        latlngs = trail[i].getLatLngs() as LatLng[];
        for (let j = 0; j < latlngs.length; j++) {
          d = this.marker.getLatLng().distanceTo(latlngs[j]);
          if (distance > d) {
            distance = d;
            this.trailPosition = [i, j];
          }
        }
      }
    }
    //adding a poi in the list in its correct position accoding to its position on the trail

    destroy() {
      this.marker.remove();
      this.marker.off("click").off("dragend");
      this.marker = null as any;
    }
  }