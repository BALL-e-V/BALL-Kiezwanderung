import { jsPDF } from "jspdf";
import { wanderwegeConfig } from "$lib/config";
import type {
  InstructionBlock,
  InstructionSpan,
} from "../types";

const { print: printConfig } = wanderwegeConfig;

function layoutInstructionBlocks(
  doc: jsPDF,
  directions: string[],
  directionsMarkerFrequency: number,
  width: number,
  startInstructionIndex: number,
): InstructionBlock[] {
  const lines: InstructionSpan[][] = [[]];
  let lineWidth = 0;
  let blockLineCount = 1;
  const startLine = () => {
    lines.push([]);
    blockLineCount += 1;
    lineWidth = 0;
  };
  const startBlock = () => {
    while (blockLineCount % 5 !== 0) {
      lines.push([]);
      blockLineCount += 1;
    }
    lines.push([]);
    blockLineCount = 1;
    lineWidth = 0;
  };
  const appendText = (
    text: string,
    bold: boolean,
    instructionIndex: number,
  ) => {
    if (!text) return;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const spanWidth = doc.getTextWidth(text);
    const line = lines[lines.length - 1];
    const previousSpan = line[line.length - 1];
    if (
      previousSpan?.bold === bold &&
      previousSpan.instructionIndex === instructionIndex
    ) {
      previousSpan.text += text;
    } else {
      line.push({ text, bold, instructionIndex });
    }
    lineWidth += spanWidth;
  };

  const appendInstruction = (
    instruction: string,
    bold: boolean,
    instructionIndex: number,
  ) => {
    if (blockLineCount > 5) startBlock();

    if (lines[lines.length - 1].length > 0) {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const separator = "   ";
      if (lineWidth + doc.getTextWidth(separator) <= width) {
        appendText(separator, bold, instructionIndex);
      } else {
        startLine();
      }
    }

    for (const word of instruction.split(/\s+/).filter(Boolean)) {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      if (
        lines[lines.length - 1].length > 0 &&
        lineWidth + doc.getTextWidth(` ${word}`) > width
      ) {
        startLine();
      }

      let remainingWord = word;
      let needsSpace = lines[lines.length - 1].length > 0;
      while (remainingWord.length > 0) {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        const availableWidth =
          width - lineWidth - (needsSpace ? doc.getTextWidth(" ") : 0);
        let fittingCharacters = 0;
        for (let count = 1; count <= remainingWord.length; count++) {
          if (
            doc.getTextWidth(remainingWord.slice(0, count)) > availableWidth
          )
            break;
          fittingCharacters = count;
        }
        if (fittingCharacters === 0) {
          startLine();
          needsSpace = false;
          continue;
        }
        appendText(
          `${needsSpace ? " " : ""}${remainingWord.slice(0, fittingCharacters)}`,
          bold,
          instructionIndex,
        );
        remainingWord = remainingWord.slice(fittingCharacters);
        needsSpace = false;
        if (remainingWord.length > 0) startLine();
      }
    }
  };

  directions
    .slice(startInstructionIndex)
    .forEach((instruction, relativeIndex) => {
      const instructionIndex = startInstructionIndex + relativeIndex;
      const bold =
        directionsMarkerFrequency > 0 &&
        (instructionIndex + 1) % directionsMarkerFrequency === 0;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      if (blockLineCount > 5) startBlock();

      const previousLines = lines.map((line) =>
        line.map((span) => ({ ...span })),
      );
      const previousLineWidth = lineWidth;
      const previousBlockLineCount = blockLineCount;
      const blockWasNotEmpty = lines
        .slice(-blockLineCount)
        .some((line) => line.length > 0);
      appendInstruction(instruction, bold, instructionIndex);

      if (
        blockWasNotEmpty &&
        blockLineCount > 5 &&
        doc.splitTextToSize(instruction, width).length <= 5
      ) {
        lines.splice(0, lines.length, ...previousLines);
        lineWidth = previousLineWidth;
        blockLineCount = previousBlockLineCount;
        startBlock();
        appendInstruction(instruction, bold, instructionIndex);
      }
    });

  while (lines.length > 0 && lines[lines.length - 1].length === 0) lines.pop();
  const blocks: InstructionBlock[] = [];
  for (let index = 0; index < lines.length; index += 5) {
    const blockLines = lines.slice(index, index + 5);
    const startInstruction =
      blockLines.flat().at(0)?.instructionIndex ?? startInstructionIndex;
    blocks.push({ lines: blockLines, startInstruction });
  }
  return blocks;
}

export function drawDirections({
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
}: {
  doc: jsPDF;
  directions: string[];
  directionsMarkerFrequency: number;
  textWidth: number;
  textX: number;
  continuationTextWidth: number;
  titleText: string;
  pageLeftMargin: number;
  pageTopMargin: number;
  pageHeight: number;
  descriptionStartY: number;
  descriptionLineHeight: number;
  descriptionFontSize: number;
  firstPageBottomMargin: number;
  continuationBottomMargin: number;
  printOnlyDirections: boolean;
  addContinuationNotice: (noticeX?: number) => void;
}) {
  const startContinuationPage = () => {
    addContinuationNotice();
    doc.addPage();
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(printConfig.trailTitleFontSize);
    const continuationTitleLines = doc.splitTextToSize(
      titleText,
      continuationTextWidth,
    );
    doc.text(continuationTitleLines, pageLeftMargin, pageTopMargin + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(descriptionFontSize);
    return (
      pageTopMargin +
      continuationTitleLines.length * 7 +
      printConfig.margins.continuationTitleDescription
    );
  };

  const drawBlock = (block: InstructionBlock, x: number, y: number) => {
    block.lines.forEach((line) => {
      let currentX = x;
      line.forEach((span) => {
        doc.setFont("helvetica", span.bold ? "bold" : "normal");
        doc.setFontSize(descriptionFontSize);
        doc.text(span.text, currentX, y);
        currentX += doc.getTextWidth(span.text);
      });
      y += descriptionLineHeight;
    });
    return y;
  };

  let currentY = descriptionStartY;
  const firstPageBlocks = layoutInstructionBlocks(
    doc,
    directions,
    directionsMarkerFrequency,
    textWidth,
    0,
  );
  let overflowInstructionIndex: number | null = null;

  for (let blockIndex = 0; blockIndex < firstPageBlocks.length; blockIndex++) {
    const block = firstPageBlocks[blockIndex];
    const blockHeight = block.lines.length * descriptionLineHeight;
    if (currentY + blockHeight > pageHeight - firstPageBottomMargin) {
      overflowInstructionIndex = block.startInstruction;
      break;
    }
    currentY = drawBlock(block, textX, currentY);
    if (blockIndex < firstPageBlocks.length - 1)
      currentY += descriptionLineHeight * (2 / 3);
  }

  if (overflowInstructionIndex !== null) {
    currentY = startContinuationPage();
    const continuationBlocks = layoutInstructionBlocks(
      doc,
      directions,
      directionsMarkerFrequency,
      continuationTextWidth,
      overflowInstructionIndex,
    );
    for (
      let blockIndex = 0;
      blockIndex < continuationBlocks.length;
      blockIndex++
    ) {
      const block = continuationBlocks[blockIndex];
      const blockHeight = block.lines.length * descriptionLineHeight;
      if (currentY + blockHeight > pageHeight - continuationBottomMargin) {
        currentY = startContinuationPage();
      }
      currentY = drawBlock(block, pageLeftMargin, currentY);
      if (blockIndex < continuationBlocks.length - 1)
        currentY += descriptionLineHeight * (2 / 3);
    }
  } else if (!printOnlyDirections) {
    doc.addPage();
    currentY = pageTopMargin;
  }

  return currentY;
}
