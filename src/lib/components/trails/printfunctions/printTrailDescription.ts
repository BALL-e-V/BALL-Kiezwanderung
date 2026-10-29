import { jsPDF } from "jspdf";
import { wanderwegeConfig } from "$lib/config";

const { print: printConfig } = wanderwegeConfig;
type ContinuationNotice = (noticeX?: number) => void;

function splitFirstPageText(
  doc: jsPDF,
  text: string,
  width: number,
  lineLimit: number,
) {
  const firstPageLines: string[] = [];
  const remainingSourceLines: string[] = [];
  let pageIsFull = false;

  for (const sourceLine of text.split(/\r?\n/)) {
    const wrappedLines = sourceLine
      ? doc.splitTextToSize(sourceLine, width)
      : [""];

    if (pageIsFull) {
      remainingSourceLines.push(sourceLine);
      continue;
    }

    const availableLines = lineLimit - firstPageLines.length;
    firstPageLines.push(...wrappedLines.slice(0, availableLines));
    if (wrappedLines.length > availableLines) {
      remainingSourceLines.push(wrappedLines.slice(availableLines).join(" "));
    }
    pageIsFull = firstPageLines.length >= lineLimit;
  }

  return { firstPageLines, remainingSourceLines };
}

export function drawInitialPageDescription({
  doc,
  text,
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
}: {
  doc: jsPDF;
  text: string;
  titleText: string;
  textX: number;
  textWidth: number;
  descriptionStartY: number;
  descriptionFontSize: number;
  descriptionLineHeight: number;
  pageHeight: number;
  pageLeftMargin: number;
  pageTopMargin: number;
  continuationRightMargin: number;
  continuationBottomMargin: number;
  addContinuationNotice: ContinuationNotice;
}) {
  const firstPageBottomMargin = 5;
  const firstPageLineLimit = Math.max(
    1,
    Math.floor(
      (pageHeight - firstPageBottomMargin - descriptionStartY) /
        descriptionLineHeight,
    ) + 1,
  );
  const { firstPageLines, remainingSourceLines } = splitFirstPageText(
    doc,
    text,
    textWidth,
    firstPageLineLimit,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(descriptionFontSize);
  doc.text(firstPageLines, textX, descriptionStartY);
  let nextContentY =
    descriptionStartY +
    firstPageLines.length * descriptionLineHeight +
    printConfig.margins.contentBlock;

  if (remainingSourceLines.some((line) => line.trim())) {
    addContinuationNotice(textX);
    const continuationTextWidth =
      doc.internal.pageSize.getWidth() -
      pageLeftMargin -
      continuationRightMargin;

    const addContinuationPage = (
      leftMargin: number,
      topMargin: number,
      width: number,
    ) => {
      addContinuationNotice(textX);
      doc.addPage();
      let currentY = topMargin;
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(printConfig.trailTitleFontSize);
      const continuationTitleLines = doc.splitTextToSize(titleText, width);
      doc.text(continuationTitleLines, leftMargin, currentY + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(descriptionFontSize);
      currentY +=
        continuationTitleLines.length * 7 +
        printConfig.margins.continuationTitleDescription;
      return currentY;
    };

    const splitContinuationText = (
      sourceLines: string[],
      width: number,
      lineLimit: number,
    ) => {
      const textLines = sourceLines.flatMap((line) =>
        line ? doc.splitTextToSize(line, width) : [""],
      );
      const pages: string[][] = [];
      let remaining = textLines;

      while (remaining.length > 0) {
        pages.push(remaining.slice(0, lineLimit));
        remaining = remaining.slice(lineLimit);
      }

      return pages;
    };

    const drawContinuationPage = (
      leftMargin: number,
      topMargin: number,
      width: number,
    ) => {
      let currentY = addContinuationPage(leftMargin, topMargin, width);
      const maxLines = Math.max(
        1,
        Math.floor(
          (doc.internal.pageSize.getHeight() -
            currentY -
            continuationBottomMargin) /
            descriptionLineHeight,
        ) + 1,
      );
      const continuationPages = splitContinuationText(
        remainingSourceLines,
        width,
        maxLines,
      );

      continuationPages.forEach((chunk, index) => {
        doc.text(chunk, leftMargin, currentY);

        if (index < continuationPages.length - 1) {
          currentY = addContinuationPage(leftMargin, topMargin, width);
        }
      });
      return (
        currentY +
        (continuationPages.at(-1)?.length ?? 0) * descriptionLineHeight +
        printConfig.margins.contentBlock
      );
    };

    nextContentY = drawContinuationPage(
      pageLeftMargin,
      pageTopMargin,
      continuationTextWidth,
    );
  }

  return { nextContentY, firstPageBottomMargin };
}

export function drawDescriptionAfterDirections({
  doc,
  text,
  titleText,
  startY,
  descriptionFontSize,
  descriptionLineHeight,
  pageHeight,
  pageLeftMargin,
  pageTopMargin,
  continuationRightMargin,
  continuationBottomMargin,
  addContinuationNotice,
}: {
  doc: jsPDF;
  text: string;
  titleText: string;
  startY: number;
  descriptionFontSize: number;
  descriptionLineHeight: number;
  pageHeight: number;
  pageLeftMargin: number;
  pageTopMargin: number;
  continuationRightMargin: number;
  continuationBottomMargin: number;
  addContinuationNotice: ContinuationNotice;
}) {
  let descriptionPageY = startY + printConfig.margins.contentBlock;
  const descriptionPageWidth =
    doc.internal.pageSize.getWidth() -
    pageLeftMargin -
    continuationRightMargin;
  const descriptionLines = text
    ? doc.splitTextToSize(text, descriptionPageWidth)
    : doc.splitTextToSize(
        "Keine Beschreibung verfügbar.",
        descriptionPageWidth,
      );
  let descriptionLineIndex = 0;

  while (descriptionLineIndex < descriptionLines.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(printConfig.trailTitleFontSize);
    const descriptionTitleLines = doc.splitTextToSize(
      titleText,
      descriptionPageWidth,
    );
    const descriptionTitleHeight =
      descriptionTitleLines.length * 7 +
      printConfig.margins.continuationTitleDescription;
    if (
      descriptionLineIndex > 0 ||
      descriptionPageY + descriptionTitleHeight + descriptionLineHeight >
        pageHeight - continuationBottomMargin
    ) {
      addContinuationNotice(pageLeftMargin);
      doc.addPage();
      descriptionPageY = pageTopMargin;
    }

    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(printConfig.trailTitleFontSize);
    doc.text(descriptionTitleLines, pageLeftMargin, descriptionPageY + 7);
    descriptionPageY +=
      descriptionTitleLines.length * 7 +
      printConfig.margins.continuationTitleDescription;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(descriptionFontSize);
    const descriptionPageLineLimit = Math.max(
      1,
      Math.floor(
        (pageHeight - descriptionPageY - continuationBottomMargin) /
          descriptionLineHeight,
      ) + 1,
    );
    const pageDescriptionLines = descriptionLines.slice(
      descriptionLineIndex,
      descriptionLineIndex + descriptionPageLineLimit,
    );
    doc.text(pageDescriptionLines, pageLeftMargin, descriptionPageY);
    descriptionLineIndex += pageDescriptionLines.length;
    descriptionPageY += pageDescriptionLines.length * descriptionLineHeight;
  }

  return descriptionPageY + printConfig.margins.contentBlock;
}
