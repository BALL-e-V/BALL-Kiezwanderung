import { jsPDF } from "jspdf";
import { wanderwegeConfig } from "$lib/config";
import type { TrailPrintContext } from "../types";

const { print: printConfig } = wanderwegeConfig;

type TrailPrintPoi = TrailPrintContext["poisByTrailId"] extends Map<
  string,
  (infer Poi)[]
>
  ? Poi
  : never;

type ContinuationNotice = (noticeX?: number) => void;

export async function fetchImageData(imageUrl: string) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("data:")) return imageUrl;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function drawTrailPois({
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
}: {
  doc: jsPDF;
  trailPois: TrailPrintPoi[];
  descriptionFontSize: number;
  poiImageArea: number;
  pageLeftMargin: number;
  pageTopMargin: number;
  pageWidth: number;
  pageHeight: number;
  textX: number;
  textWidth: number;
  nextContentY: number;
  firstPageBottomMargin: number;
  addContinuationNotice: ContinuationNotice;
}) {
  const descriptionLineHeight = descriptionFontSize * (5 / 12);
  const poiLineHeight = descriptionFontSize * (5 / 12);
  const poiRightMargin = pageWidth - (textX + textWidth);
  const poiBottomMargin = firstPageBottomMargin;
  let poiY = Math.max(nextContentY, pageTopMargin);

  for (const [index, poi] of trailPois.entries()) {
    const poiImage = await fetchImageData(poi.imageUrl ?? "");
    const imageGap = printConfig.margins.imageText;
    const imageProperties = poiImage ? doc.getImageProperties(poiImage) : null;
    const imageRatio = imageProperties
      ? imageProperties.width / imageProperties.height
      : 60 / 45;
    const poiImageWidth = Math.sqrt(poiImageArea * imageRatio);
    const poiImageHeight = poiImageArea / poiImageWidth;
    const sideTextX = pageLeftMargin + poiImageWidth + imageGap;
    const sideTextWidth = pageWidth - sideTextX - poiRightMargin;
    const fullTextWidth = pageWidth - pageLeftMargin - poiRightMargin;
    const poiTitle = `${index + 1}. ${(poi.title || "Foto").trim()}`;
    const poiDescription = (
      poi.description || "Keine Beschreibung verfügbar."
    ).trim();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(printConfig.poiTitleFontSize);
    const poiTitleLines = doc.splitTextToSize(poiTitle, sideTextWidth);
    const poiBlockHeight = Math.max(
      poiImageHeight,
      poiTitleLines.length * printConfig.poiTitleFontSize * (5 / 12) +
        printConfig.margins.poiTitle,
    );
    if (poiY + poiBlockHeight > pageHeight - poiBottomMargin) {
      doc.addPage();
      poiY = pageTopMargin;
    }

    const imageY = poiY;
    const textY = poiY;
    if (poiImage && imageProperties) {
      doc.addImage(
        poiImage,
        imageProperties.fileType,
        pageLeftMargin,
        imageY,
        poiImageWidth,
        poiImageHeight,
      );
    }

    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(printConfig.poiTitleFontSize);
    doc.text(poiTitleLines, sideTextX, textY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(descriptionFontSize);
    const poiDescriptionStartY =
      textY +
      poiTitleLines.length * printConfig.poiTitleFontSize * (5 / 12) +
      descriptionLineHeight +
      printConfig.margins.poiDescription;
    const sideLineLimit = Math.max(
      0,
      Math.ceil(
        (poiImageHeight - (poiDescriptionStartY - textY)) / poiLineHeight,
      ),
    );
    const sideLines: string[] = [];
    const remainingPoiSourceLines: string[] = [];
    let sideIsFull = false;

    for (const sourceLine of poiDescription.split(/\r?\n/)) {
      const wrappedLines = sourceLine
        ? doc.splitTextToSize(sourceLine, sideTextWidth)
        : [""];
      if (sideIsFull) {
        remainingPoiSourceLines.push(sourceLine);
        continue;
      }
      const availableLines = sideLineLimit - sideLines.length;
      sideLines.push(...wrappedLines.slice(0, availableLines));
      if (wrappedLines.length > availableLines) {
        remainingPoiSourceLines.push(
          wrappedLines.slice(availableLines).join(" "),
        );
      }
      sideIsFull = sideLines.length >= sideLineLimit;
    }

    if (sideLines.length > 0) {
      doc.text(sideLines, sideTextX, poiDescriptionStartY);
    }

    const fullWidthStartY =
      imageY + poiImageHeight + printConfig.margins.imageDescription;
    const fullWidthLines = remainingPoiSourceLines.flatMap((line) =>
      line ? doc.splitTextToSize(line, fullTextWidth) : [""],
    );
    let remainingFullWidthLines = fullWidthLines;
    let currentY = fullWidthStartY;
    let fullWidthEndY = fullWidthStartY;
    if (
      remainingFullWidthLines.length > 0 &&
      fullWidthStartY > pageHeight - poiBottomMargin
    ) {
      addContinuationNotice(sideTextX);
      doc.addPage();
      currentY = pageTopMargin;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(descriptionFontSize);
    }
    while (remainingFullWidthLines.length > 0) {
      const fullWidthLineLimit = Math.max(
        1,
        Math.floor((pageHeight - poiBottomMargin - currentY) / poiLineHeight),
      );
      const pageLines = remainingFullWidthLines.slice(0, fullWidthLineLimit);
      doc.text(pageLines, pageLeftMargin, currentY);
      fullWidthEndY = currentY + pageLines.length * poiLineHeight;
      remainingFullWidthLines =
        remainingFullWidthLines.slice(fullWidthLineLimit);
      if (remainingFullWidthLines.length > 0) {
        addContinuationNotice();
        doc.addPage();
        currentY = pageTopMargin;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(descriptionFontSize);
      }
    }
    poiY =
      fullWidthLines.length > 0
        ? fullWidthEndY + 8
        : imageY + poiBlockHeight + printConfig.margins.contentBlock;
  }
}
