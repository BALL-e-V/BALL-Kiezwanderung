import type { LatLng, LatLngBounds, Marker, Polyline } from "leaflet";

export type TrailDirections = { location: LatLng; instruction: string }[];

export interface NavigationSettings {
  instructions: boolean;
  distances: boolean;
  tracking: boolean;
}

export interface HikingTrail {
  title: string;
  id: string;
  imageUrl?: string;
  imageAlt?: string;
  description?: string;
  districts: string[];
  startDistricts: string[];
  length: number | null;
  bounds: LatLngBounds;
  start: LatLng;
  end: LatLng;
  trail: LatLng[][];
  polyline?: Polyline;
  startMarker: Marker;
  endMarker: Marker;
  directions?: TrailDirections;
  reverseDirections?: TrailDirections;
  poiTitles: string[];
  poiImages: Array<{
    title: string;
    imageUrl?: string | null;
    imageAlt?: string | null;
  }>;
}

export interface FilteredTrail {
  data: HikingTrail;
  display: boolean;
  color: string;
  loading: boolean;
  matchedDistricts?: string[];
  matchedPoiTitles?: string[];
  matchedPoiImageUrl?: string;
  matchedPoiImageAlt?: string;
  reversed: boolean;
}

export type TrailSort = "name" | "length";

export type TrailSearchResult = {
  trail: HikingTrail;
  matchedDistricts: string[];
  matchedPoiTitles: string[];
  matchedPoiImageUrl?: string;
  matchedPoiImageAlt?: string;
};

export interface SearchData {
  nameQuery: string;
  districtQuery: string;
  poiQuery: string;
  onlyStart: boolean;
  selectedMinLength: number | null;
  selectedMaxLength: number | null;
}

export interface SearchInterfaceProps {
  trails: HikingTrail[];
  onSearch: (trails: TrailSearchResult[]) => void;
  noTrailsFound?: boolean;
  searchData?: SearchData;
}

export interface TrailDisplayProps {
  trails: FilteredTrail[];
  pageNumber: number;
  pageCount: number;
  totalItems: number;
  sortBy: TrailSort | null;
  sortAscending: boolean;
  onSelectTrail: (trail: FilteredTrail) => void;
  onMapMode: () => void;
  onPageChange: (targetPage: number) => void;
  onSort: (criterion: TrailSort) => void;
}

export interface PageNavigationProps {
  pageNumber: number;
  pageCount: number;
  totalItems: number;
  onPageChange: (targetPage: number) => void;
  variant?: "default" | "map";
  showPageSelect?: boolean;
}

export interface NavigationPanelProps {
  directions: { instruction: string }[];
  currentIndex: number;
  distancesEnabled: boolean;
  trackingEnabled: boolean;
  error: string;
  mobileTooltipHeight: number;
  distanceForDirection: (index: number) => number | null;
  onIndexChange: (index: number) => void;
}

export interface RightClickMenuProps {
  x: number;
  y: number;
  hasFocusedTrail: boolean;
  onSearch: () => void;
  onList: () => void;
  onShowAll: () => void;
  isOnlyResult: boolean;
}

export interface PrintOptionsProps {
  descriptionFontSize: number;
  poiImageSize: "small" | "large";
  displayDirections: boolean;
  showDirectionDistance: boolean;
  onlyDirections: boolean;
  markDirections: boolean;
  directionsMarkerFrequency: number;
  directionMarkerSize: string;
  isPrinting: boolean;
  onClose: () => void;
  onPrint: () => void;
}

export interface LegendTrail {
  data: Pick<HikingTrail, "title" | "bounds">;
  display: boolean;
  color: string;
}

export interface LegendProps {
  trails: LegendTrail[];
  poiTitles: string[];
  printMapBounds?: LatLngBounds | null;
  pageNumber: number;
  pageCount: number;
  totalItems: number;
  onTrailSelect?: (index: number) => void;
  onPoiSelect?: (index: number) => void;
  onPageChange: (targetPage: number) => void;
  focussedTrail: boolean;
}

export interface ImageGaleryProps {
  imageUrls: string[];
  imageAlts: string[];
  poiTitles: string[];
  currentSlideItem: number;
  closeGalery: (currentSlideItem: number) => void;
}

export interface TrailPoiPopupProps {
  title?: string;
  description?: string;
  imageUrls?: string[];
  imageAlts?: string[];
  length?: number;
  poiCount?: number;
  activePoiIndex?: number;
  isPoiSelection?: boolean;
  onClose?: (index: number) => void;
  onSelectPoi?: (index: number) => void;
  highlightImageMarker: (index: number, previous?: number) => void;
  showGalery: () => void;
}

export interface TrailPoiTooltipProps {
  x: number;
  y: number;
  title: string;
  excerpt: string;
  imageUrl?: string;
  imageAlt?: string;
  length: number;
  matchedDistricts?: string[];
  matchedPoiTitles?: string[];
  placement: "left" | "right";
  containerHeight?: number;
  offsetX?: number;
  offsetY?: number;
}

export type InstructionSpan = {
  text: string;
  bold: boolean;
  instructionIndex: number;
};

export type InstructionBlock = {
  lines: InstructionSpan[][];
  startInstruction: number;
};

export type TrailPrintContext = {
  printMapElement: HTMLDivElement;
  focussedTrail: {
    data: {
      id: string;
      title: string;
      description?: string | null;
    };
  };
  directions: string[];
  trailBoundsRatio: number;
  poisByTrailId: Map<
    string,
    Array<{
      id: string;
      title?: string;
      description?: string | null;
      imageUrl?: string | null;
      lat?: number;
      lng?: number;
    }>
  >;
  descriptionFontSize: number;
  poiImageArea: number;
  displayDirections: boolean;
  onlyDirections: boolean;
  directionsMarkerFrequency: number;
};
