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
        id: string;
        title: string;
        description?: string | null;
    };
    trailBoundsRatio: number;
    poisByTrailId: Map<string, Array<{ id: string; title?: string; description?: string | null; imageUrl?: string | null; lat?: number; lng?: number }>>;
    fetchImageData: (imageUrl: string) => Promise<string | null>;
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
    trailBoundsRatio,
    poisByTrailId,
    fetchImageData,
}: TrailPrintContext) {
    const dataUrl = await domtoimage.toJpeg(printMapElement, { quality: 1, bgcolor: "white" });
    const descriptionLineHeight = printConfig.descriptionFontSize * (5 / 12);
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
        textX = imgX + imgW + 10;
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
        textX = imgX + imgW + 10;
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

    const titleText = (focussedTrail.title || "Wanderweg").trim();
    const descriptionText = (focussedTrail.description || "Keine Beschreibung verfügbar.").trim();
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

    doc.addImage(dataUrl, "JPEG", imgX, imgY, imgW, imgH);

    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(printConfig.trailTitleFontSize);
    const titleLines = doc.splitTextToSize(titleText, textWidth);
    const titleHeight = titleLines.length * 7;
    doc.text(titleLines, textX, textY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(printConfig.descriptionFontSize);

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

    const { firstPageLines, remainingSourceLines } = splitFirstPageText(
        descriptionText,
        textWidth,
        firstPageLineLimit,
    );
    doc.text(firstPageLines, textX, descriptionStartY);
    let nextContentY = descriptionStartY + firstPageLines.length * descriptionLineHeight + printConfig.margins.contentBlock;

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
            const titleLines = doc.splitTextToSize(titleText, textWidth);
            doc.text(titleLines, leftMargin, currentY + 7);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(printConfig.descriptionFontSize);
            currentY += titleLines.length * 7 + printConfig.margins.continuationTitleDescription;
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

    const trailPois = poisByTrailId.get(focussedTrail.id) ?? [];
    const poiLineHeight = printConfig.descriptionFontSize * (5 / 12);
    const poiImageArea = printConfig.poiImageArea;
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
        doc.setFontSize(printConfig.descriptionFontSize);
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
            doc.setFontSize(printConfig.descriptionFontSize);
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
                doc.setFontSize(printConfig.descriptionFontSize);
            }
        }
        poiY = fullWidthLines.length > 0
            ? fullWidthEndY + 8
            : imageY + poiBlockHeight + printConfig.margins.contentBlock;
    }

    doc.save(`${focussedTrail.title || "wanderweg"}.pdf`);
}
