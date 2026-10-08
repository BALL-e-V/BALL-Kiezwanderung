import domtoimage from "dom-to-image-more";
import { jsPDF } from "jspdf";
import { wanderwegeConfig } from "$lib/config";

const { print: printConfig } = wanderwegeConfig;

export type TrailPrintConfig = {
    descriptionFontSize: number;
    trailTitleFontSize: number;
    poiTitleFontSize: number;
    poiImageArea: number;
    margins: {
        mapContent: number;
        titleDescription: number;
        contentBlock: number;
        continuationTitleDescription: number;
        imageText: number;
        poiTitle: number;
        poiDescription: number;
        imageDescription: number;
    };
    startEndSize: number;
    poiSize: number;
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
    poisByTrailId: Map<string, Array<{ id: string; title?: string; description?: string | null; imageUrl?: string | null; lat?: number; lng?: number }>>;
    fetchImageData: (imageUrl: string) => Promise<string | null>;
    descriptionFontSize: number;
    poiImageArea: number;
    displayDirections: boolean;
    onlyDirections: boolean;
    directionsMarkerFrequency: number;
};

export async function fetchImageData(imageUrl: string) {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("data:")) return imageUrl;

    try {
        const response = await fetch(imageUrl);
        if (!response.ok) return null;
        const blob = await response.blob();
        return await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

export async function printTrail({
    printMapElement,
    focussedTrail,
    directions,
    trailBoundsRatio,
    poisByTrailId,
    fetchImageData,
    descriptionFontSize,
    poiImageArea,
    displayDirections,
    onlyDirections,
    directionsMarkerFrequency,
}: TrailPrintContext) {
    const printOnlyDirections = onlyDirections && displayDirections;
    const dataUrl = await domtoimage.toPng(printMapElement, { quality: 1, bgcolor: "white" });
    const descriptionLineHeight = descriptionFontSize * (5 / 12);
    let doc: jsPDF;
    let pageLeftMargin = 5;
    let pageTopMargin = 5;
    let imgX = pageLeftMargin;
    let imgY = pageTopMargin;
    let imgW = 100;
    let imgH = 287;
    let textX = pageLeftMargin;
    let textY = pageTopMargin;
    let textWidth = 190;
    let pageWidth = 210;
    let pageHeight = 297;

    if (trailBoundsRatio < 0.3) {
        doc = new jsPDF({ unit: "mm", hotfixes: ["px_scaling"] });
        pageWidth = doc.internal.pageSize.getWidth();
        pageHeight = doc.internal.pageSize.getHeight();
        pageLeftMargin = 20;
        pageTopMargin = 5;
        imgX = pageLeftMargin;
        imgY = pageTopMargin;
        imgW = 100;
        imgH = 287;
        textX = imgX + imgW + 5;
        textY = imgY;
        textWidth = Math.max(50, pageWidth - textX - 5);
    } else if (trailBoundsRatio < 1) {
        doc = new jsPDF({ orientation: "l", unit: "mm", hotfixes: ["px_scaling"]  });
        pageWidth = doc.internal.pageSize.getWidth();
        pageHeight = doc.internal.pageSize.getHeight();
        pageLeftMargin = 5;
        pageTopMargin = 20;
        imgX = pageLeftMargin;
        imgY = pageTopMargin;
        imgW = 140;
        imgH = 185;
        textX = imgX + imgW + 5;
        textY = imgY;
        textWidth = Math.max(50, pageWidth - textX - 5);
    } else if (trailBoundsRatio < 3) {
        doc = new jsPDF({ unit: "mm", hotfixes: ["px_scaling"] });
        pageWidth = doc.internal.pageSize.getWidth();
        pageHeight = doc.internal.pageSize.getHeight();
        pageLeftMargin = 20;
        pageTopMargin = 5;
        imgX = pageLeftMargin;
        imgY = pageTopMargin;
        imgW = 185;
        imgH = 140;
        textX = pageLeftMargin;
        textY = imgY + imgH + printConfig.margins.mapContent;
        textWidth = pageWidth - pageLeftMargin * 2;
    } else {
        doc = new jsPDF({ orientation: "l", unit: "mm", hotfixes: ["px_scaling"] });
        pageWidth = doc.internal.pageSize.getWidth();
        pageHeight = doc.internal.pageSize.getHeight();
        pageLeftMargin = 5;
        pageTopMargin = 20;
        imgX = pageLeftMargin;
        imgY = pageTopMargin;
        imgW = 287;
        imgH = 100;
        textX = pageLeftMargin;
        textY = imgY + imgH + printConfig.margins.mapContent;
        textWidth = pageWidth - pageLeftMargin * 2;
    }

    const titleText = (focussedTrail.data.title || "Wanderweg").trim();
    const descriptionText = (focussedTrail.data.description || "Keine Beschreibung verfügbar.").trim();
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

    const descriptionStartY = textY + titleHeight + printConfig.margins.titleDescription;
    const firstPageBottomMargin = 5;
    const firstPageLineLimit = Math.max(
        1,
        Math.floor((pageHeight - firstPageBottomMargin - descriptionStartY) / descriptionLineHeight) + 1,
    );

    const splitFirstPageText = (text: string, width: number, lineLimit: number) => {
        const firstPageLines: string[] = [];
        const remainingSourceLines: string[] = [];
        let pageIsFull = false;

        for (const sourceLine of text.split(/\r?\n/)) {
            const wrappedLines = sourceLine ? doc.splitTextToSize(sourceLine, width) : [""];

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
    };

    let nextContentY: number;
    if (displayDirections) {
        const instructions = directions.map((instruction) => instruction.trim()).filter(Boolean);
        type InstructionSpan = { text: string; bold: boolean; instructionIndex: number };
        type InstructionBlock = { lines: InstructionSpan[][]; startInstruction: number };
        const continuationTextWidth = doc.internal.pageSize.getWidth() - pageLeftMargin - continuationRightMargin;
        const layoutInstructionBlocks = (width: number, startInstructionIndex: number): InstructionBlock[] => {
            const lines: InstructionSpan[][] = [[]];
            let lineWidth = 0;
            let blockLineCount = 1;
            const startLine = () => {
                lines.push([]);
                blockLineCount += 1;
                lineWidth = 0;
            };
            const startBlock = () => {
                while (blockLineCount < 5) {
                    lines.push([]);
                    blockLineCount += 1;
                }
                while (blockLineCount > 5 && blockLineCount % 5 !== 0) {
                    lines.push([]);
                    blockLineCount += 1;
                }
                lines.push([]);
                blockLineCount = 1;
                lineWidth = 0;
            };
            const appendText = (text: string, bold: boolean, instructionIndex: number) => {
                if (!text) return;
                doc.setFont("helvetica", bold ? "bold" : "normal");
                const width = doc.getTextWidth(text);
                const line = lines[lines.length - 1];
                const previousSpan = line[line.length - 1];
                if (previousSpan?.bold === bold && previousSpan.instructionIndex === instructionIndex) {
                    previousSpan.text += text;
                } else {
                    line.push({ text, bold, instructionIndex });
                }
                lineWidth += width;
            };

            const appendInstruction = (instruction: string, bold: boolean, instructionIndex: number) => {
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
                    if (lines[lines.length - 1].length > 0 && lineWidth + doc.getTextWidth(` ${word}`) > width) {
                        startLine();
                    }

                    let remainingWord = word;
                    let needsSpace = lines[lines.length - 1].length > 0;
                    while (remainingWord.length > 0) {
                        doc.setFont("helvetica", bold ? "bold" : "normal");
                        const availableWidth = width - lineWidth - (needsSpace ? doc.getTextWidth(" ") : 0);
                        let fittingCharacters = 0;
                        for (let count = 1; count <= remainingWord.length; count++) {
                            if (doc.getTextWidth(remainingWord.slice(0, count)) > availableWidth) break;
                            fittingCharacters = count;
                        }
                        if (fittingCharacters === 0) {
                            startLine();
                            needsSpace = false;
                            continue;
                        }
                        appendText(`${needsSpace ? " " : ""}${remainingWord.slice(0, fittingCharacters)}`, bold, instructionIndex);
                        remainingWord = remainingWord.slice(fittingCharacters);
                        needsSpace = false;
                        if (remainingWord.length > 0) startLine();
                    }
                }
            };

            instructions.slice(startInstructionIndex).forEach((instruction, relativeIndex) => {
                const instructionIndex = startInstructionIndex + relativeIndex;
                const bold = directionsMarkerFrequency > 0 &&
                    (instructionIndex + 1) % directionsMarkerFrequency === 0;
                doc.setFont("helvetica", bold ? "bold" : "normal");
                if (blockLineCount > 5) startBlock();

                const previousLines = lines.map((line) => line.map((span) => ({ ...span })));
                const previousLineWidth = lineWidth;
                const previousBlockLineCount = blockLineCount;
                const blockWasNotEmpty = lines.slice(-blockLineCount).some((line) => line.length > 0);
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
                const startInstruction = blockLines.flat().at(0)?.instructionIndex ?? startInstructionIndex;
                blocks.push({ lines: blockLines, startInstruction });
            }
            return blocks;
        };

        const startContinuationPage = () => {
            addContinuationNotice(textX);
            doc.addPage();
            doc.setTextColor(30, 30, 30);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(printConfig.trailTitleFontSize);
            const continuationTitleLines = doc.splitTextToSize(titleText, continuationTextWidth);
            doc.text(continuationTitleLines, pageLeftMargin, pageTopMargin + 7);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(descriptionFontSize);
            return pageTopMargin + continuationTitleLines.length * 7 + printConfig.margins.continuationTitleDescription;
        };

        let currentY = descriptionStartY;
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

        const firstPageBlocks = layoutInstructionBlocks(textWidth, 0);
        let overflowInstructionIndex: number | null = null;
        for (let blockIndex = 0; blockIndex < firstPageBlocks.length; blockIndex++) {
            const block = firstPageBlocks[blockIndex];
            const blockHeight = block.lines.length * descriptionLineHeight;
            if (currentY + blockHeight > pageHeight - firstPageBottomMargin) {
                overflowInstructionIndex = block.startInstruction;
                break;
            }
            currentY = drawBlock(block, textX, currentY);
            if (blockIndex < firstPageBlocks.length - 1) currentY += descriptionLineHeight * (2 / 3);
        }

        if (overflowInstructionIndex !== null) {
            currentY = startContinuationPage();
            const continuationBlocks = layoutInstructionBlocks(continuationTextWidth, overflowInstructionIndex);
            for (let blockIndex = 0; blockIndex < continuationBlocks.length; blockIndex++) {
                const block = continuationBlocks[blockIndex];
                const blockHeight = block.lines.length * descriptionLineHeight;
                if (currentY + blockHeight > pageHeight - continuationBottomMargin) {
                    currentY = startContinuationPage();
                }
                currentY = drawBlock(block, pageLeftMargin, currentY);
                if (blockIndex < continuationBlocks.length - 1) currentY += descriptionLineHeight * (2 / 3);
            }
        } else if (!printOnlyDirections) {
            doc.addPage();
            currentY = pageTopMargin;
        }

        if (printOnlyDirections) {
            nextContentY = currentY;
        } else {
            currentY += printConfig.margins.contentBlock;
            const descriptionPageWidth = doc.internal.pageSize.getWidth() - pageLeftMargin - continuationRightMargin;
            const descriptionLines = descriptionText
                ? doc.splitTextToSize(descriptionText, descriptionPageWidth)
                : doc.splitTextToSize("Keine Beschreibung verfügbar.", descriptionPageWidth);
            let descriptionLineIndex = 0;
            let descriptionPageY = currentY;

            while (descriptionLineIndex < descriptionLines.length) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(printConfig.trailTitleFontSize);
                const descriptionTitleLines = doc.splitTextToSize(titleText, descriptionPageWidth);
                const descriptionTitleHeight =
                    descriptionTitleLines.length * 7 + printConfig.margins.continuationTitleDescription;
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
                descriptionPageY += descriptionTitleLines.length * 7 + printConfig.margins.continuationTitleDescription;

                doc.setFont("helvetica", "normal");
                doc.setFontSize(descriptionFontSize);
                const descriptionPageLineLimit = Math.max(
                    1,
                    Math.floor((pageHeight - descriptionPageY - continuationBottomMargin) / descriptionLineHeight) + 1,
                );
                const pageDescriptionLines = descriptionLines.slice(
                    descriptionLineIndex,
                    descriptionLineIndex + descriptionPageLineLimit,
                );
                doc.text(pageDescriptionLines, pageLeftMargin, descriptionPageY);
                descriptionLineIndex += pageDescriptionLines.length;
                descriptionPageY += pageDescriptionLines.length * descriptionLineHeight;
            }
            nextContentY = descriptionPageY + printConfig.margins.contentBlock;
        }
    } else {
        const { firstPageLines, remainingSourceLines } = splitFirstPageText(
            descriptionText,
            textWidth,
            firstPageLineLimit,
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(descriptionFontSize);
        doc.text(firstPageLines, textX, descriptionStartY);
        nextContentY = descriptionStartY + firstPageLines.length * descriptionLineHeight + printConfig.margins.contentBlock;

        if (remainingSourceLines.some((line) => line.trim())) {
            addContinuationNotice(textX);
            const continuationTextWidth = doc.internal.pageSize.getWidth() - pageLeftMargin - continuationRightMargin;

            const addContinuationPage = (leftMargin: number, topMargin: number, textWidth: number) => {
                addContinuationNotice(textX);
                doc.addPage();
                let currentY = topMargin;
                doc.setTextColor(30, 30, 30);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(printConfig.trailTitleFontSize);
                const continuationTitleLines = doc.splitTextToSize(titleText, textWidth);
                doc.text(continuationTitleLines, leftMargin, currentY + 7);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(descriptionFontSize);
                currentY += continuationTitleLines.length * 7 + printConfig.margins.continuationTitleDescription;
                return currentY;
            };

            const splitContinuationText = (sourceLines: string[], width: number, lineLimit: number) => {
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

            const drawContinuationPage = (leftMargin: number, topMargin: number, textWidth: number) => {
                let currentY = addContinuationPage(leftMargin, topMargin, textWidth);
                const maxLines = Math.max(1, Math.floor((doc.internal.pageSize.getHeight() - currentY - continuationBottomMargin) / descriptionLineHeight) + 1);
                const continuationPages = splitContinuationText(remainingSourceLines, textWidth, maxLines);

                continuationPages.forEach((chunk, index) => {
                    doc.text(chunk, leftMargin, currentY);

                    if (index < continuationPages.length - 1) {
                        currentY = addContinuationPage(leftMargin, topMargin, textWidth);
                    }
                });
                return currentY + (continuationPages.at(-1)?.length ?? 0) * descriptionLineHeight + printConfig.margins.contentBlock;
            };

            nextContentY = drawContinuationPage(
                pageLeftMargin,
                pageTopMargin,
                continuationTextWidth,
            );
        }
    }

    const trailPois = printOnlyDirections
        ? []
        : poisByTrailId.get(focussedTrail.data.id) ?? [];
    const poiLineHeight = descriptionFontSize * (5 / 12);
    const poiRightMargin = pageWidth - (textX + textWidth);
    const poiBottomMargin = firstPageBottomMargin;
    let poiY = Math.max(nextContentY, pageTopMargin);

    for (const [index, poi] of trailPois.entries()) {
        const poiImage = await fetchImageData(poi.imageUrl ?? "");
        const imageGap = printConfig.margins.imageText;
        const imageProperties = poiImage ? doc.getImageProperties(poiImage) : null;
        const imageRatio = imageProperties ? imageProperties.width / imageProperties.height : 60 / 45;
        const poiImageWidth = Math.sqrt(poiImageArea * imageRatio);
        const poiImageHeight = poiImageArea / poiImageWidth;
        const sideTextX = pageLeftMargin + poiImageWidth + imageGap;
        const sideTextWidth = pageWidth - sideTextX - poiRightMargin;
        const fullTextWidth = pageWidth - pageLeftMargin - poiRightMargin;
        const poiTitle = `${index + 1}. ${(poi.title || "Foto").trim()}`;
        const poiDescription = (poi.description || "Keine Beschreibung verfügbar.").trim();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(printConfig.poiTitleFontSize);
        const poiTitleLines = doc.splitTextToSize(poiTitle, sideTextWidth);
        const poiBlockHeight = Math.max(
            poiImageHeight,
            poiTitleLines.length * printConfig.poiTitleFontSize * (5 / 12) + printConfig.margins.poiTitle,
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
        const poiDescriptionStartY = textY + poiTitleLines.length * printConfig.poiTitleFontSize * (5 / 12) + descriptionLineHeight + printConfig.margins.poiDescription;
        const sideLineLimit = Math.max(
            0,
            Math.ceil((poiImageHeight - (poiDescriptionStartY - textY)) / poiLineHeight),
        );
        const sideLines: string[] = [];
        const remainingPoiSourceLines: string[] = [];
        let sideIsFull = false;

        for (const sourceLine of poiDescription.split(/\r?\n/)) {
            const wrappedLines = sourceLine ? doc.splitTextToSize(sourceLine, sideTextWidth) : [""];
            if (sideIsFull) {
                remainingPoiSourceLines.push(sourceLine);
                continue;
            }
            const availableLines = sideLineLimit - sideLines.length;
            sideLines.push(...wrappedLines.slice(0, availableLines));
            if (wrappedLines.length > availableLines) {
                remainingPoiSourceLines.push(wrappedLines.slice(availableLines).join(" "));
            }
            sideIsFull = sideLines.length >= sideLineLimit;
        }

        if (sideLines.length > 0) {
            doc.text(sideLines, sideTextX, poiDescriptionStartY);
        }

        const fullWidthStartY = imageY + poiImageHeight + printConfig.margins.imageDescription;
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
            remainingFullWidthLines = remainingFullWidthLines.slice(fullWidthLineLimit);
            if (remainingFullWidthLines.length > 0) {
                addContinuationNotice();
                doc.addPage();
                currentY = pageTopMargin;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(descriptionFontSize);
            }
        }
        poiY = fullWidthLines.length > 0
            ? fullWidthEndY + 8
            : imageY + poiBlockHeight + printConfig.margins.contentBlock;
    }

    doc.save(`${focussedTrail.data.title || "wanderweg"}.pdf`);
}
