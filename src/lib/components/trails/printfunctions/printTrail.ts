import domtoimage from "dom-to-image-more";
import { wanderwegeConfig } from "$lib/config";
import type { TrailPrintContext } from "../types";
import {
  drawDescriptionAfterDirections,
  drawInitialPageDescription,
} from "./printTrailDescription";
import { drawDirections } from "./printTrailDirections";
import { drawTrailPois } from "./printTrailPois";
import { createPrintLayout } from "./printTrailLayout";

const { print: printConfig } = wanderwegeConfig;

export { fetchImageData } from "./printTrailPois";

export async function printTrail({
  printMapElement,
  focussedTrail,
  directions,
  trailBoundsRatio,
  poisByTrailId,
  descriptionFontSize,
  poiImageArea,
  displayDirections,
  onlyDirections,
  directionsMarkerFrequency,
}: TrailPrintContext) {
  const printOnlyDirections = onlyDirections && displayDirections;
  const dataUrl = await domtoimage.toPng(printMapElement, {
    quality: 1,
    bgcolor: "white",
  });
  const descriptionLineHeight = descriptionFontSize * (5 / 12);
  const {
    doc,
    pageLeftMargin,
    pageTopMargin,
    imgX,
    imgY,
    imgW,
    imgH,
    textX,
    textY,
    textWidth,
    pageWidth,
    pageHeight,
  } = createPrintLayout(trailBoundsRatio);

  const titleText = (focussedTrail.data.title || "Wanderweg").trim();
  const descriptionText = (
    focussedTrail.data.description || "Keine Beschreibung verfügbar."
  ).trim();
  const continuationRightMargin = 5;
  const continuationBottomMargin = 5;
  const addContinuationNotice = (noticeX = textX) => {
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      "Auf der nächsten Seite weiter -->",
      noticeX,
      pageHeight - continuationBottomMargin,
    );
  };

  doc.addImage(dataUrl, "PNG", imgX, imgY, imgW, imgH);

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(printConfig.trailTitleFontSize);
  const titleLines = doc.splitTextToSize(titleText, textWidth);
  const titleHeight = titleLines.length * 7;
  doc.text(titleLines, textX, textY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(descriptionFontSize);

  const descriptionStartY =
    textY + titleHeight + printConfig.margins.titleDescription;
  const firstPageBottomMargin = 5;
  let nextContentY: number;

  if (displayDirections) {
    const continuationTextWidth =
      doc.internal.pageSize.getWidth() -
      pageLeftMargin -
      continuationRightMargin;
    const currentY = drawDirections({
      doc,
      directions,
      directionsMarkerFrequency,
      textWidth,
      textX,
      continuationTextWidth,
      titleText,
      pageLeftMargin,
      pageTopMargin,
      pageHeight,
      descriptionStartY,
      descriptionLineHeight,
      descriptionFontSize,
      firstPageBottomMargin,
      continuationBottomMargin,
      printOnlyDirections,
      addContinuationNotice,
    });

    nextContentY = printOnlyDirections
      ? currentY
      : drawDescriptionAfterDirections({
          doc,
          text: descriptionText,
          titleText,
          startY: currentY,
          descriptionFontSize,
          descriptionLineHeight,
          pageHeight,
          pageLeftMargin,
          pageTopMargin,
          continuationRightMargin,
          continuationBottomMargin,
          addContinuationNotice,
        });
  } else {
    ({ nextContentY } = drawInitialPageDescription({
      doc,
      text: descriptionText,
      titleText,
      textX,
      textWidth,
      descriptionStartY,
      descriptionFontSize,
      descriptionLineHeight,
      pageHeight,
      pageLeftMargin,
      pageTopMargin,
      continuationRightMargin,
      continuationBottomMargin,
      addContinuationNotice,
    }));
  }

  const trailPois = printOnlyDirections
    ? []
    : (poisByTrailId.get(focussedTrail.data.id) ?? []);
  await drawTrailPois({
    doc,
    trailPois,
    descriptionFontSize,
    poiImageArea,
    pageLeftMargin,
    pageTopMargin,
    pageWidth,
    pageHeight,
    textX,
    textWidth,
    nextContentY,
    firstPageBottomMargin,
    addContinuationNotice,
  });

  doc.save(`${focussedTrail.data.title || "wanderweg"}.pdf`);
}
